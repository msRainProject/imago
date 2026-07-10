package service

import (
	"encoding/json"
	"testing"

	"github.com/go-webauthn/webauthn/webauthn"
)

// TestLoadStoredCredentials_LegacyShape verifies that data written by
// the previous build (a bare []webauthn.Credential) still decodes after
// we introduce the wrapping struct. This is the migration contract.
func TestLoadStoredCredentials_LegacyShape(t *testing.T) {
	cred := webauthn.Credential{
		ID:              []byte("test-cred-id-001"),
		PublicKey:       []byte("\x04\x01\x02\x03"),
		AttestationType: "none",
	}
	raw, err := json.Marshal([]webauthn.Credential{cred})
	if err != nil {
		t.Fatalf("marshal legacy: %v", err)
	}

	stored, err := loadStoredCredentials(raw)
	if err != nil {
		t.Fatalf("load legacy: %v", err)
	}
	if len(stored) != 1 {
		t.Fatalf("want 1 stored credential, got %d", len(stored))
	}
	if string(stored[0].Credential.ID) != string(cred.ID) {
		t.Errorf("credential ID mismatch: got %q want %q", stored[0].Credential.ID, cred.ID)
	}
	if stored[0].CreatedAt != 0 {
		t.Errorf("legacy row should decode with CreatedAt=0, got %d", stored[0].CreatedAt)
	}
	if stored[0].LastUsedAt != 0 {
		t.Errorf("legacy row should decode with LastUsedAt=0, got %d", stored[0].LastUsedAt)
	}
}

// TestLoadStoredCredentials_WrappedShape verifies the new shape carries
// the binding timestamp through the round-trip.
func TestLoadStoredCredentials_WrappedShape(t *testing.T) {
	original := []storedCredential{
		{
			Credential: webauthn.Credential{
				ID:              []byte("cred-a"),
				PublicKey:       []byte("\x04\x01"),
				AttestationType: "none",
			},
			CreatedAt:  1719250000,
			LastUsedAt: 1719250600,
		},
		{
			Credential: webauthn.Credential{
				ID:              []byte("cred-b"),
				PublicKey:       []byte("\x04\x02"),
				AttestationType: "none",
			},
			CreatedAt:  1719250500,
			LastUsedAt: 1719250700,
		},
	}
	raw, err := marshalStoredCredentials(original)
	if err != nil {
		t.Fatalf("marshal wrapped: %v", err)
	}

	loaded, err := loadStoredCredentials(raw)
	if err != nil {
		t.Fatalf("load wrapped: %v", err)
	}
	if len(loaded) != 2 {
		t.Fatalf("want 2 stored credentials, got %d", len(loaded))
	}
	for i, sc := range loaded {
		if sc.CreatedAt != original[i].CreatedAt {
			t.Errorf("cred[%d] CreatedAt = %d, want %d", i, sc.CreatedAt, original[i].CreatedAt)
		}
		if sc.LastUsedAt != original[i].LastUsedAt {
			t.Errorf("cred[%d] LastUsedAt = %d, want %d", i, sc.LastUsedAt, original[i].LastUsedAt)
		}
		if string(sc.Credential.ID) != string(original[i].Credential.ID) {
			t.Errorf("cred[%d] ID = %q, want %q", i, sc.Credential.ID, original[i].Credential.ID)
		}
	}
}

// TestLoadStoredCredentials_EmptyAndGarbage covers the two degenerate
// inputs the loader must accept without panicking.
func TestLoadStoredCredentials_EmptyAndGarbage(t *testing.T) {
	if got, err := loadStoredCredentials(nil); err != nil || got != nil {
		t.Errorf("nil input: want (nil,nil), got (%v,%v)", got, err)
	}
	if got, err := loadStoredCredentials([]byte{}); err != nil || got != nil {
		t.Errorf("empty input: want (nil,nil), got (%v,%v)", got, err)
	}
	if _, err := loadStoredCredentials([]byte("not json")); err == nil {
		t.Errorf("garbage input: want error, got nil")
	}
}
