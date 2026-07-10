package service

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"hill-images/internal/config"
	"hill-images/internal/models"
	"hill-images/internal/repository"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"
)

type WebAuthnService struct {
	baseConfig  config.WebAuthnConfig
	configRepo  *repository.ConfigRepo
	userRepo    *repository.UserRepo
	authService *AuthService
	sessions    *sessionStore
}

type sessionRecord struct {
	config    config.WebAuthnConfig
	session   *webauthn.SessionData
	userID    uuid.UUID
	createdAt time.Time
}

type sessionStore struct {
	mu            sync.RWMutex
	registrations map[string]sessionRecord
	assertions    map[string]sessionRecord
}

func newSessionStore() *sessionStore {
	return &sessionStore{
		registrations: make(map[string]sessionRecord),
		assertions:    make(map[string]sessionRecord),
	}
}

func NewWebAuthnService(cfg *config.WebAuthnConfig, configRepo *repository.ConfigRepo, userRepo *repository.UserRepo, authService *AuthService) (*WebAuthnService, error) {
	service := &WebAuthnService{
		baseConfig:  *cfg,
		configRepo:  configRepo,
		userRepo:    userRepo,
		authService: authService,
		sessions:    newSessionStore(),
	}

	if _, _, err := service.currentWebAuthn(); err != nil {
		return nil, err
	}
	return service, nil
}

func (s *WebAuthnService) resolveConfig() (config.WebAuthnConfig, error) {
	cfg := s.baseConfig
	if s.configRepo == nil {
		return cfg, nil
	}
	return s.configRepo.ResolveWebAuthnConfig(cfg)
}

func buildWebAuthn(cfg config.WebAuthnConfig) (*webauthn.WebAuthn, error) {
	if strings.TrimSpace(cfg.RPID) == "" {
		return nil, errors.New("webauthn RP ID is required")
	}
	if strings.TrimSpace(cfg.RPName) == "" {
		return nil, errors.New("webauthn RP display name is required")
	}
	origins := cfg.Origins()
	if len(origins) == 0 {
		return nil, errors.New("at least one webauthn origin is required")
	}

	wconfig := &webauthn.Config{
		RPID:          cfg.RPID,
		RPDisplayName: cfg.RPName,
		RPOrigins:     origins,
	}
	return webauthn.New(wconfig)
}

func (s *WebAuthnService) currentWebAuthn() (*webauthn.WebAuthn, config.WebAuthnConfig, error) {
	cfg, err := s.resolveConfig()
	if err != nil {
		return nil, cfg, err
	}
	wa, err := buildWebAuthn(cfg)
	if err != nil {
		return nil, cfg, err
	}
	return wa, cfg, nil
}

func (s *WebAuthnService) webAuthnForSession(sessionCfg config.WebAuthnConfig) (*webauthn.WebAuthn, error) {
	return buildWebAuthn(sessionCfg)
}

type webauthnUser struct {
	id          []byte
	name        string
	displayName string
	credentials []webauthn.Credential
}

func (u *webauthnUser) WebAuthnID() []byte                         { return u.id }
func (u *webauthnUser) WebAuthnName() string                       { return u.name }
func (u *webauthnUser) WebAuthnDisplayName() string                { return u.displayName }
func (u *webauthnUser) WebAuthnCredentials() []webauthn.Credential { return u.credentials }

// storedCredential is the on-disk shape of a single WebAuthn credential
// stored in `users.webauthn_credentials`. We wrap the upstream
// `webauthn.Credential` so we can attach server-side metadata (binding
// timestamp) that the library does not track itself.
//
// The field order is important: `Credential` MUST be the first field so
// the legacy JSON layout (`[{...credential fields...}]`) round-trips
// without a migration step — older rows just decode with `CreatedAt`
// defaulting to 0, which we treat as "unknown" on the UI.
type storedCredential struct {
	webauthn.Credential
	FriendlyName string `json:"friendly_name,omitempty"`
	CreatedAt    int64  `json:"created_at"`
	LastUsedAt   int64  `json:"last_used_at,omitempty"`
}

// loadStoredCredentials reads the on-disk JSON into our wrapped form.
// Falls back to legacy (un-wrapped) JSON for older rows so an upgrade
// does not brick existing accounts.
func loadStoredCredentials(raw []byte) ([]storedCredential, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	var stored []storedCredential
	if err := json.Unmarshal(raw, &stored); err == nil && len(stored) > 0 && len(stored[0].Credential.ID) > 0 {
		return stored, nil
	}
	// Legacy: rows written before the wrapper was introduced encode a
	// bare []webauthn.Credential. Migrate in-memory; the next write
	// will persist the wrapped form.
	var legacy []webauthn.Credential
	if err := json.Unmarshal(raw, &legacy); err != nil {
		return nil, err
	}
	stored = make([]storedCredential, 0, len(legacy))
	for _, c := range legacy {
		stored = append(stored, storedCredential{Credential: c, CreatedAt: 0, LastUsedAt: 0})
	}
	return stored, nil
}

// marshalStoredCredentials renders the wrapped list as compact JSON.
func marshalStoredCredentials(stored []storedCredential) ([]byte, error) {
	if len(stored) == 0 {
		return nil, nil
	}
	return json.Marshal(stored)
}

func (s *WebAuthnService) ToWebAuthnUser(user *models.User) (*webauthnUser, error) {
	id := user.WebAuthnID
	if len(id) == 0 {
		id = []byte(user.ID.String())
	}

	stored, err := loadStoredCredentials(user.WebAuthnCredentials)
	if err != nil {
		return nil, err
	}
	creds := make([]webauthn.Credential, 0, len(stored))
	for _, sc := range stored {
		creds = append(creds, sc.Credential)
	}

	return &webauthnUser{
		id:          id,
		name:        user.Username,
		displayName: user.Username,
		credentials: creds,
	}, nil
}

func (s *WebAuthnService) BeginRegistration(user *models.User) (*protocol.CredentialCreation, *webauthn.SessionData, error) {
	waUser, err := s.ToWebAuthnUser(user)
	if err != nil {
		return nil, nil, err
	}
	wa, _, err := s.currentWebAuthn()
	if err != nil {
		return nil, nil, err
	}
	return wa.BeginRegistration(waUser)
}

func (s *WebAuthnService) StoreRegistrationSession(key string, session *webauthn.SessionData, userID uuid.UUID) error {
	cfg, err := s.resolveConfig()
	if err != nil {
		return err
	}
	s.sessions.mu.Lock()
	defer s.sessions.mu.Unlock()
	s.sessions.registrations[key] = sessionRecord{config: cfg, session: session, userID: userID, createdAt: time.Now()}
	return nil
}

func (s *WebAuthnService) GetRegistrationSession(key string) (*webauthn.SessionData, uuid.UUID, config.WebAuthnConfig) {
	s.sessions.mu.RLock()
	defer s.sessions.mu.RUnlock()
	record, ok := s.sessions.registrations[key]
	if !ok {
		return nil, uuid.Nil, config.WebAuthnConfig{}
	}
	return record.session, record.userID, record.config
}

func (s *WebAuthnService) DeleteRegistrationSession(key string) {
	s.sessions.mu.Lock()
	defer s.sessions.mu.Unlock()
	delete(s.sessions.registrations, key)
}

func (s *WebAuthnService) FinishRegistration(user *models.User, session *webauthn.SessionData, sessionCfg config.WebAuthnConfig, r *http.Request) (*webauthn.Credential, error) {
	waUser, err := s.ToWebAuthnUser(user)
	if err != nil {
		return nil, err
	}
	wa, err := s.webAuthnForSession(sessionCfg)
	if err != nil {
		return nil, err
	}
	return wa.FinishRegistration(waUser, *session, r)
}

func (s *WebAuthnService) SaveCredential(user *models.User, cred *webauthn.Credential, friendlyName string) error {
	stored, err := loadStoredCredentials(user.WebAuthnCredentials)
	if err != nil {
		return err
	}
	if friendlyName == "" {
		friendlyName = fmt.Sprintf("Passkey %d", len(stored)+1)
	}
	stored = append(stored, storedCredential{
		Credential:   *cred,
		FriendlyName: friendlyName,
		CreatedAt:    time.Now().Unix(),
		LastUsedAt:   0,
	})

	data, err := marshalStoredCredentials(stored)
	if err != nil {
		return err
	}
	user.WebAuthnCredentials = data

	if len(user.WebAuthnID) == 0 {
		user.WebAuthnID = []byte(user.ID.String())
	}

	return s.userRepo.Update(user)
}

func (s *WebAuthnService) BeginLogin(user *models.User) (*protocol.CredentialAssertion, *webauthn.SessionData, error) {
	waUser, err := s.ToWebAuthnUser(user)
	if err != nil {
		return nil, nil, err
	}
	wa, _, err := s.currentWebAuthn()
	if err != nil {
		return nil, nil, err
	}
	return wa.BeginLogin(waUser)
}

func (s *WebAuthnService) StoreAssertionSession(key string, session *webauthn.SessionData, userID uuid.UUID) error {
	cfg, err := s.resolveConfig()
	if err != nil {
		return err
	}
	s.sessions.mu.Lock()
	defer s.sessions.mu.Unlock()
	s.sessions.assertions[key] = sessionRecord{config: cfg, session: session, userID: userID, createdAt: time.Now()}
	return nil
}

func (s *WebAuthnService) GetAssertionSession(key string) (*webauthn.SessionData, uuid.UUID, config.WebAuthnConfig) {
	s.sessions.mu.RLock()
	defer s.sessions.mu.RUnlock()
	record, ok := s.sessions.assertions[key]
	if !ok {
		return nil, uuid.Nil, config.WebAuthnConfig{}
	}
	return record.session, record.userID, record.config
}

func (s *WebAuthnService) DeleteAssertionSession(key string) {
	s.sessions.mu.Lock()
	defer s.sessions.mu.Unlock()
	delete(s.sessions.assertions, key)
}

func (s *WebAuthnService) FinishLogin(user *models.User, session *webauthn.SessionData, sessionCfg config.WebAuthnConfig, r *http.Request) (*webauthn.Credential, error) {
	waUser, err := s.ToWebAuthnUser(user)
	if err != nil {
		return nil, err
	}
	wa, err := s.webAuthnForSession(sessionCfg)
	if err != nil {
		return nil, err
	}
	cred, err := wa.FinishLogin(waUser, *session, r)
	if err != nil {
		return nil, err
	}

	stored, err := loadStoredCredentials(user.WebAuthnCredentials)
	if err != nil {
		return nil, err
	}
	matched := false
	for i := range stored {
		if string(stored[i].Credential.ID) == string(cred.ID) {
			stored[i].Credential = *cred
			if stored[i].FriendlyName == "" {
				stored[i].FriendlyName = fmt.Sprintf("Passkey %d", i+1)
			}
			stored[i].LastUsedAt = time.Now().Unix()
			matched = true
			break
		}
	}
	if !matched {
		now := time.Now().Unix()
		stored = append(stored, storedCredential{
			Credential:   *cred,
			FriendlyName: fmt.Sprintf("Passkey %d", len(stored)+1),
			CreatedAt:    now,
			LastUsedAt:   now,
		})
	}
	data, mErr := marshalStoredCredentials(stored)
	if mErr != nil {
		return nil, mErr
	}
	user.WebAuthnCredentials = data
	if uErr := s.userRepo.Update(user); uErr != nil {
		return nil, uErr
	}

	return cred, nil
}

func (s *WebAuthnService) FindUserByCredentialID(credentialID []byte) (*models.User, error) {
	users, err := s.userRepo.ListAll()
	if err != nil {
		return nil, err
	}
	for i := range users {
		u := &users[i]
		if len(u.WebAuthnCredentials) == 0 {
			continue
		}
		stored, err := loadStoredCredentials(u.WebAuthnCredentials)
		if err != nil {
			continue
		}
		for _, sc := range stored {
			if string(sc.Credential.ID) == string(credentialID) {
				return u, nil
			}
		}
	}
	return nil, nil
}

// PasskeyCredentialInfo is a safe-to-render summary of a stored
// WebAuthn credential for the management UI.
type PasskeyCredentialInfo struct {
	CredentialID string `json:"credential_id"`
	FriendlyName string `json:"friendly_name"`
	CreatedAt    int64  `json:"created_at"`
	LastUsedAt   int64  `json:"last_used_at"`
}

// ListCredentials returns the current user's stored WebAuthn credentials.
func (s *WebAuthnService) ListCredentials(user *models.User) ([]PasskeyCredentialInfo, error) {
	if len(user.WebAuthnCredentials) == 0 {
		return []PasskeyCredentialInfo{}, nil
	}
	stored, err := loadStoredCredentials(user.WebAuthnCredentials)
	if err != nil {
		return nil, err
	}
	out := make([]PasskeyCredentialInfo, 0, len(stored))
	for i, sc := range stored {
		name := sc.FriendlyName
		if name == "" {
			name = fmt.Sprintf("Passkey %d", i+1)
		}
		out = append(out, PasskeyCredentialInfo{
			CredentialID: base64URLEncode(sc.Credential.ID),
			FriendlyName: name,
			CreatedAt:    sc.CreatedAt,
			LastUsedAt:   sc.LastUsedAt,
		})
	}
	return out, nil
}

// DeleteCredential removes a single WebAuthn credential by its
// base64url-encoded ID. Returns ErrCredentialNotFound when no match.
//
// The browser always speaks base64url (no padding) for WebAuthn
// credential IDs, but the go-webauthn library stores them in standard
// base64 inside the user row. We accept the URL-safe form from the
// management API and compare against the raw bytes — the encoding
// difference is purely a transport concern, not a content one.
func (s *WebAuthnService) DeleteCredential(user *models.User, credentialIDB64 string) error {
	if len(user.WebAuthnCredentials) == 0 {
		return ErrCredentialNotFound
	}
	target, err := base64URLDecode(credentialIDB64)
	if err != nil {
		return ErrCredentialNotFound
	}
	stored, err := loadStoredCredentials(user.WebAuthnCredentials)
	if err != nil {
		return err
	}
	kept := make([]storedCredential, 0, len(stored))
	found := false
	for _, sc := range stored {
		if string(sc.Credential.ID) == string(target) {
			found = true
			continue
		}
		kept = append(kept, sc)
	}
	if !found {
		return ErrCredentialNotFound
	}
	data, err := marshalStoredCredentials(kept)
	if err != nil {
		return err
	}
	user.WebAuthnCredentials = data
	return s.userRepo.Update(user)
}

// ErrCredentialNotFound signals a missing passkey for management calls.
var ErrCredentialNotFound = errors.New("passkey credential not found")

func base64URLEncode(b []byte) string {
	return base64.RawURLEncoding.EncodeToString(b)
}

func base64URLDecode(s string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(s)
}

// FindUserByWebAuthnID resolves the user that owns a userHandle from a
// discoverable (passkey) assertion. Returns (nil, nil) when no match —
// callers must treat that as a failed lookup, not an error, to match
// FindUserByCredentialID's contract.
func (s *WebAuthnService) FindUserByWebAuthnID(userHandle []byte) (*models.User, error) {
	if len(userHandle) == 0 {
		return nil, nil
	}
	users, err := s.userRepo.ListAll()
	if err != nil {
		return nil, err
	}
	for i := range users {
		u := &users[i]
		if len(u.WebAuthnID) > 0 && string(u.WebAuthnID) == string(userHandle) {
			return u, nil
		}
	}
	return nil, nil
}

// BeginDiscoverableLogin issues a challenge without a pinned user or
// allowCredentials list. Session.UserID stays nil so WebAuthnLoginVerify
// can dispatch to FinishDiscoverableLogin.
func (s *WebAuthnService) BeginDiscoverableLogin() (*protocol.CredentialAssertion, *webauthn.SessionData, error) {
	wa, _, err := s.currentWebAuthn()
	if err != nil {
		return nil, nil, err
	}
	return wa.BeginDiscoverableLogin()
}

// FinishDiscoverableLogin validates a discoverable assertion. The library
// calls the DiscoverableUserHandler with (rawID, userHandle); we resolve the
// owning user via FindUserByWebAuthnID, then persist the updated credential
// and last-login timestamp, mirroring the username-bound FinishLogin path.
func (s *WebAuthnService) FinishDiscoverableLogin(session *webauthn.SessionData, sessionCfg config.WebAuthnConfig, r *http.Request) (*models.User, *webauthn.Credential, error) {
	handler := func(rawID, userHandle []byte) (webauthn.User, error) {
		u, err := s.FindUserByWebAuthnID(userHandle)
		if err != nil {
			return nil, err
		}
		if u == nil {
			return nil, errors.New("no user owns the asserted passkey")
		}
		return s.ToWebAuthnUser(u)
	}

	parsed, err := protocol.ParseCredentialRequestResponse(r)
	if err != nil {
		return nil, nil, err
	}

	wa, err := s.webAuthnForSession(sessionCfg)
	if err != nil {
		return nil, nil, err
	}
	cred, err := wa.ValidateDiscoverableLogin(handler, *session, parsed)
	if err != nil {
		return nil, nil, err
	}

	user, err := s.FindUserByWebAuthnID(parsed.Response.UserHandle)
	if err != nil || user == nil {
		return nil, nil, errors.New("user vanished after passkey verification")
	}

	stored, err := loadStoredCredentials(user.WebAuthnCredentials)
	if err == nil {
		for i := range stored {
			if string(stored[i].Credential.ID) == string(cred.ID) {
				stored[i].Credential = *cred
				stored[i].LastUsedAt = time.Now().Unix()
				if data, mErr := marshalStoredCredentials(stored); mErr == nil {
					user.WebAuthnCredentials = data
				}
				_ = s.userRepo.Update(user)
				break
			}
		}
	}

	now := time.Now()
	user.LastLoginAt = &now
	_ = s.userRepo.Update(user)

	return user, cred, nil
}

func (s *WebAuthnService) StartCleanup(interval time.Duration) {
	const sessionTTL = 5 * time.Minute
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for range ticker.C {
			s.sessions.mu.Lock()
			now := time.Now()
			for k, v := range s.sessions.registrations {
				if now.Sub(v.createdAt) > sessionTTL {
					delete(s.sessions.registrations, k)
				}
			}
			for k, v := range s.sessions.assertions {
				if now.Sub(v.createdAt) > sessionTTL {
					delete(s.sessions.assertions, k)
				}
			}
			s.sessions.mu.Unlock()
		}
	}()
}
