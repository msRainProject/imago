package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"
	"unicode/utf8"

	"hill-images/internal/models"
	"hill-images/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	authService     *service.AuthService
	webauthnService *service.WebAuthnService
}

func NewAuthHandler(authService *service.AuthService, webauthnService *service.WebAuthnService) *AuthHandler {
	return &AuthHandler{
		authService:     authService,
		webauthnService: webauthnService,
	}
}

type registerRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required,min=8"`
}

type loginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type webauthnLoginChallengeRequest struct {
	Username string `json:"username"`
}

type webauthnVerifyRequest struct {
	SessionKey   string          `json:"session_key"`
	Credential   json.RawMessage `json:"credential"`
	FriendlyName string          `json:"friendly_name"`
}

func errorResponse(c *gin.Context, status int, msg string, errCode string) {
	c.JSON(status, gin.H{"code": status, "error": errCode, "message": msg})
}

func successResponse(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, gin.H{"code": 200, "data": data})
}

// credentialsResponse is a concrete JSON envelope for the credentials list
// endpoint. Using a named struct instead of gin.H avoids potential type-erasure
// issues with interface{} boxing of typed slices — an empty
// []PasskeyCredentialInfo{} passed through gin.H can sometimes serialize as
// {"data":null} or produce an extra nesting layer.
type credentialsResponse struct {
	Code int                             `json:"code"`
	Data []service.PasskeyCredentialInfo `json:"data"`
}

func createdResponse(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, gin.H{"code": 201, "data": data})
}

// extractWebAuthnPayload reads the wrapped frontend JSON body
// `{session_key, credential}` and rewrites the request body so the
// go-webauthn library sees only the raw credential object it expects.
func extractWebAuthnPayload(c *gin.Context) (sessionKey string, err error) {
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return "", err
	}
	defer c.Request.Body.Close()

	if len(bodyBytes) == 0 {
		c.Request.Body = io.NopCloser(bytes.NewReader(nil))
		return c.Query("session_key"), nil
	}

	var req webauthnVerifyRequest
	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		c.Request.Body = io.NopCloser(bytes.NewReader(bodyBytes))
		return c.Query("session_key"), nil
	}

	sessionKey = c.Query("session_key")
	if sessionKey == "" {
		sessionKey = req.SessionKey
	}

	credentialBody := bodyBytes
	if len(req.Credential) > 0 {
		credentialBody = req.Credential
	}

	c.Request.Body = io.NopCloser(bytes.NewReader(credentialBody))
	c.Request.ContentLength = int64(len(credentialBody))

	return sessionKey, nil
}

func extractWebAuthnVerifyRequest(c *gin.Context) (req webauthnVerifyRequest, sessionKey string, err error) {
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return req, "", err
	}
	defer c.Request.Body.Close()

	if len(bodyBytes) == 0 {
		c.Request.Body = io.NopCloser(bytes.NewReader(nil))
		return req, c.Query("session_key"), nil
	}

	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		c.Request.Body = io.NopCloser(bytes.NewReader(bodyBytes))
		return req, c.Query("session_key"), nil
	}

	sessionKey = c.Query("session_key")
	if sessionKey == "" {
		sessionKey = req.SessionKey
	}

	credentialBody := bodyBytes
	if len(req.Credential) > 0 {
		credentialBody = req.Credential
	}

	c.Request.Body = io.NopCloser(bytes.NewReader(credentialBody))
	c.Request.ContentLength = int64(len(credentialBody))

	return req, sessionKey, nil
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, "username is required and password must be at least 8 characters", "VALIDATION_ERROR")
		return
	}

	result, err := h.authService.Register(req.Username, req.Password)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, err.Error(), "REGISTER_FAILED")
		return
	}

	createdResponse(c, result)
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, "username and password are required", "VALIDATION_ERROR")
		return
	}

	result, err := h.authService.Login(req.Username, req.Password)
	if err != nil {
		errorResponse(c, http.StatusUnauthorized, "invalid credentials", "AUTH_FAILED")
		return
	}

	successResponse(c, result)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if len(authHeader) < 7 {
		errorResponse(c, http.StatusUnauthorized, "missing or invalid authorization header", "AUTH_FAILED")
		return
	}
	tokenStr := authHeader[7:]

	claims, err := h.authService.ParseTokenUnverified(tokenStr)
	if err != nil {
		errorResponse(c, http.StatusUnauthorized, "invalid token", "AUTH_FAILED")
		return
	}

	if err := h.authService.BlacklistToken(claims.ID, claims.ExpiresAt.Time); err != nil {
		errorResponse(c, http.StatusInternalServerError, "failed to blacklist token", "LOGOUT_FAILED")
		return
	}

	successResponse(c, gin.H{"message": "logged out"})
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	errorResponse(c, http.StatusNotImplemented, "not implemented", "NOT_IMPLEMENTED")
}

func (h *AuthHandler) WebAuthnRegisterChallenge(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		errorResponse(c, http.StatusUnauthorized, "authentication required", "AUTH_FAILED")
		return
	}

	userID, err := userIDFromContext(userIDStr)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "invalid user id in token", "INTERNAL_ERROR")
		return
	}

	user, err := h.authService.FindUserByID(userID)
	if err != nil {
		errorResponse(c, http.StatusNotFound, "user not found", "USER_NOT_FOUND")
		return
	}

	creation, session, err := h.webauthnService.BeginRegistration(user)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "failed to generate registration challenge", "WEBAUTHN_ERROR")
		return
	}

	sessionKey := uuid.New().String()
	if err := h.webauthnService.StoreRegistrationSession(sessionKey, session, user.ID); err != nil {
		errorResponse(c, http.StatusInternalServerError, "failed to persist registration session", "WEBAUTHN_ERROR")
		return
	}

	// creation is *webauthn.CredentialCreation which JSON-marshals as
	// {"publicKey": {...}}, wrapping the spec's PublicKeyCredentialCreationOptions
	// in an extra layer. The frontend expects the options directly (the
	// publicKey wrapper is a JSON-RPC artifact), so we unwrap .Response.
	successResponse(c, gin.H{
		"session_key": sessionKey,
		"options":     creation.Response,
	})
}

func (h *AuthHandler) WebAuthnRegisterVerify(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		errorResponse(c, http.StatusUnauthorized, "authentication required", "AUTH_FAILED")
		return
	}

	userID, err := userIDFromContext(userIDStr)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "invalid user id in token", "INTERNAL_ERROR")
		return
	}

	user, err := h.authService.FindUserByID(userID)
	if err != nil {
		errorResponse(c, http.StatusNotFound, "user not found", "USER_NOT_FOUND")
		return
	}

	verifyReq, sessionKey, err := extractWebAuthnVerifyRequest(c)
	if err != nil {
		errorResponse(c, http.StatusBadRequest, "failed to parse request body", "VALIDATION_ERROR")
		return
	}
	if sessionKey == "" {
		errorResponse(c, http.StatusBadRequest, "session_key is required", "VALIDATION_ERROR")
		return
	}

	session, _, sessionCfg := h.webauthnService.GetRegistrationSession(sessionKey)
	if session == nil {
		errorResponse(c, http.StatusBadRequest, "invalid or expired session", "SESSION_EXPIRED")
		return
	}

	cred, err := h.webauthnService.FinishRegistration(user, session, sessionCfg, c.Request)
	if err != nil {
		h.webauthnService.DeleteRegistrationSession(sessionKey)
		errorResponse(c, http.StatusBadRequest, "registration verification failed: "+err.Error(), "WEBAUTHN_VERIFY_FAILED")
		return
	}

	if err := h.webauthnService.SaveCredential(user, cred, verifyReq.FriendlyName); err != nil {
		errorResponse(c, http.StatusInternalServerError, "failed to save credential", "INTERNAL_ERROR")
		return
	}

	h.webauthnService.DeleteRegistrationSession(sessionKey)
	successResponse(c, gin.H{"registered": true})
}

func (h *AuthHandler) WebAuthnLoginChallenge(c *gin.Context) {
	username := c.Query("username")
	if username == "" {
		var req webauthnLoginChallengeRequest
		if err := c.ShouldBindJSON(&req); err == nil && req.Username != "" {
			username = req.Username
		}
	}

	sessionKey := uuid.New().String()

	if username == "" {
		assertion, session, err := h.webauthnService.BeginDiscoverableLogin()
		if err != nil {
			errorResponse(c, http.StatusInternalServerError, "failed to generate passkey challenge: "+err.Error(), "WEBAUTHN_ERROR")
			return
		}
		if err := h.webauthnService.StoreAssertionSession(sessionKey, session, uuid.Nil); err != nil {
			errorResponse(c, http.StatusInternalServerError, "failed to persist login session", "WEBAUTHN_ERROR")
			return
		}
		// assertion is *webauthn.CredentialAssertion which marshals as
		// {"publicKey": {...}}; unwrap .Response for the frontend.
		successResponse(c, gin.H{
			"session_key": sessionKey,
			"options":     assertion.Response,
		})
		return
	}

	user, err := h.authService.FindUserByUsername(username)
	if err != nil {
		errorResponse(c, http.StatusNotFound, "user not found", "USER_NOT_FOUND")
		return
	}

	assertion, session, err := h.webauthnService.BeginLogin(user)
	if err != nil {
		errorResponse(c, http.StatusBadRequest, "no WebAuthn credentials registered for this user", "NO_CREDENTIALS")
		return
	}

	if err := h.webauthnService.StoreAssertionSession(sessionKey, session, user.ID); err != nil {
		errorResponse(c, http.StatusInternalServerError, "failed to persist login session", "WEBAUTHN_ERROR")
		return
	}
	// Same publicKey wrapper unwrapping as above.
	successResponse(c, gin.H{
		"session_key": sessionKey,
		"options":     assertion.Response,
	})
}

func (h *AuthHandler) WebAuthnLoginVerify(c *gin.Context) {
	sessionKey, payloadErr := extractWebAuthnPayload(c)
	if payloadErr != nil {
		errorResponse(c, http.StatusBadRequest, "failed to parse request body", "VALIDATION_ERROR")
		return
	}
	if sessionKey == "" {
		errorResponse(c, http.StatusBadRequest, "session_key is required", "VALIDATION_ERROR")
		return
	}

	session, storedUserID, sessionCfg := h.webauthnService.GetAssertionSession(sessionKey)
	if session == nil {
		errorResponse(c, http.StatusBadRequest, "invalid or expired session", "SESSION_EXPIRED")
		return
	}

	discoverable := storedUserID == uuid.Nil

	var (
		user *models.User
		err  error
	)
	if discoverable {
		user, _, err = h.webauthnService.FinishDiscoverableLogin(session, sessionCfg, c.Request)
	} else {
		user, err = h.authService.FindUserByID(storedUserID)
		if err == nil {
			_, err = h.webauthnService.FinishLogin(user, session, sessionCfg, c.Request)
		}
	}
	if err != nil {
		h.webauthnService.DeleteAssertionSession(sessionKey)
		if discoverable {
			errorResponse(c, http.StatusUnauthorized, "passkey verification failed: "+err.Error(), "WEBAUTHN_VERIFY_FAILED")
		} else {
			errorResponse(c, http.StatusUnauthorized, "authentication verification failed: "+err.Error(), "WEBAUTHN_VERIFY_FAILED")
		}
		return
	}

	token, err := h.authService.GenerateToken(user)
	if err != nil {
		h.webauthnService.DeleteAssertionSession(sessionKey)
		errorResponse(c, http.StatusInternalServerError, "failed to generate token", "INTERNAL_ERROR")
		return
	}

	h.webauthnService.DeleteAssertionSession(sessionKey)
	successResponse(c, gin.H{
		"token": token,
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"role":     user.Role,
		},
	})
}

// ListPasskeyCredentials handles GET /api/auth/webauthn/credentials.
func (h *AuthHandler) ListPasskeyCredentials(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		errorResponse(c, http.StatusUnauthorized, "authentication required", "AUTH_FAILED")
		return
	}
	userID, err := userIDFromContext(userIDStr)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "invalid user id in token", "INTERNAL_ERROR")
		return
	}
	user, err := h.authService.FindUserByID(userID)
	if err != nil {
		errorResponse(c, http.StatusNotFound, "user not found", "USER_NOT_FOUND")
		return
	}
	creds, err := h.webauthnService.ListCredentials(user)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "failed to list credentials", "INTERNAL_ERROR")
		return
	}
	c.JSON(http.StatusOK, credentialsResponse{Code: 200, Data: creds})
}

// DeletePasskeyCredential handles DELETE /api/auth/webauthn/credentials/:id.
// The :id is the base64url-encoded credential ID.
func (h *AuthHandler) DeletePasskeyCredential(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		errorResponse(c, http.StatusUnauthorized, "authentication required", "AUTH_FAILED")
		return
	}
	userID, err := userIDFromContext(userIDStr)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "invalid user id in token", "INTERNAL_ERROR")
		return
	}
	user, err := h.authService.FindUserByID(userID)
	if err != nil {
		errorResponse(c, http.StatusNotFound, "user not found", "USER_NOT_FOUND")
		return
	}
	credID := c.Param("id")
	if credID == "" {
		errorResponse(c, http.StatusBadRequest, "credential id is required", "VALIDATION_ERROR")
		return
	}
	if err := h.webauthnService.DeleteCredential(user, credID); err != nil {
		if errors.Is(err, service.ErrCredentialNotFound) {
			errorResponse(c, http.StatusNotFound, "credential not found", "CREDENTIAL_NOT_FOUND")
			return
		}
		errorResponse(c, http.StatusInternalServerError, "failed to delete credential: "+err.Error(), "INTERNAL_ERROR")
		return
	}
	successResponse(c, gin.H{"deleted": true})
}

// PHP-compatible WebAuthn stubs (not yet implemented)

// userIDFromContext unwraps the value the JWT middleware stashed under
// "user_id". The middleware stores the typed uuid.UUID directly; some
// test paths may store a string. Accept both.
func userIDFromContext(v any) (uuid.UUID, error) {
	switch id := v.(type) {
	case uuid.UUID:
		return id, nil
	case string:
		return uuid.Parse(id)
	default:
		return uuid.Nil, errors.New("unsupported user id type")
	}
}

func (h *AuthHandler) PHPChallenge(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "PHP endpoint not yet implemented"})
}

func (h *AuthHandler) PHPVerify(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "PHP endpoint not yet implemented"})
}

func (h *AuthHandler) PHPRegChallenge(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "PHP endpoint not yet implemented"})
}

func (h *AuthHandler) PHPRegister(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "PHP endpoint not yet implemented"})
}

// --- Profile & password self-service ---

type profileResponse struct {
	ID          uuid.UUID  `json:"id"`
	Username    string     `json:"username"`
	DisplayName string     `json:"display_name"`
	Role        string     `json:"role"`
	CreatedAt   time.Time  `json:"created_at"`
	LastLoginAt *time.Time `json:"last_login_at"`
}

func userToProfileResponse(u *models.User) profileResponse {
	return profileResponse{
		ID:          u.ID,
		Username:    u.Username,
		DisplayName: u.DisplayName,
		Role:        u.Role,
		CreatedAt:   u.CreatedAt,
		LastLoginAt: u.LastLoginAt,
	}
}

// GetProfile handles GET /api/auth/profile.
func (h *AuthHandler) GetProfile(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		errorResponse(c, http.StatusUnauthorized, "authentication required", "AUTH_FAILED")
		return
	}

	userID, err := userIDFromContext(userIDStr)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "invalid user id in token", "INTERNAL_ERROR")
		return
	}

	user, err := h.authService.FindUserByID(userID)
	if err != nil {
		errorResponse(c, http.StatusNotFound, "user not found", "USER_NOT_FOUND")
		return
	}

	successResponse(c, userToProfileResponse(user))
}

type updateProfileRequest struct {
	DisplayName string `json:"display_name"`
}

// UpdateProfile handles PATCH /api/auth/profile.
func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		errorResponse(c, http.StatusUnauthorized, "authentication required", "AUTH_FAILED")
		return
	}

	userID, err := userIDFromContext(userIDStr)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "invalid user id in token", "INTERNAL_ERROR")
		return
	}

	var req updateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, "invalid request body", "VALIDATION_ERROR")
		return
	}

	nameLen := utf8.RuneCountInString(req.DisplayName)
	if nameLen < 1 || nameLen > 50 {
		errorResponse(c, http.StatusBadRequest, "display_name must be 1-50 characters", "VALIDATION_ERROR")
		return
	}

	user, err := h.authService.FindUserByID(userID)
	if err != nil {
		errorResponse(c, http.StatusNotFound, "user not found", "USER_NOT_FOUND")
		return
	}

	user.DisplayName = req.DisplayName
	if err := h.authService.UpdateUser(user); err != nil {
		errorResponse(c, http.StatusInternalServerError, "failed to update profile", "INTERNAL_ERROR")
		return
	}

	successResponse(c, userToProfileResponse(user))
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=6"`
}

// ChangePassword handles PUT /api/auth/password.
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		errorResponse(c, http.StatusUnauthorized, "authentication required", "AUTH_FAILED")
		return
	}

	userID, err := userIDFromContext(userIDStr)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "invalid user id in token", "INTERNAL_ERROR")
		return
	}

	var req changePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, "current_password and new_password (min 6 chars) are required", "VALIDATION_ERROR")
		return
	}

	user, err := h.authService.FindUserByID(userID)
	if err != nil {
		errorResponse(c, http.StatusNotFound, "user not found", "USER_NOT_FOUND")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		errorResponse(c, http.StatusUnauthorized, "current password is incorrect", "AUTH_FAILED")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "failed to hash password", "INTERNAL_ERROR")
		return
	}

	user.PasswordHash = string(hash)
	if err := h.authService.UpdateUser(user); err != nil {
		errorResponse(c, http.StatusInternalServerError, "failed to update password", "INTERNAL_ERROR")
		return
	}

	successResponse(c, gin.H{"message": "password changed"})
}
