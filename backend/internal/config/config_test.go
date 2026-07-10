package config

import (
	"reflect"
	"testing"
)

func TestParseWebAuthnOrigins(t *testing.T) {
	raw := " https://app.example.com \nhttps://admin.example.com,https://app.example.com;https://m.example.com\r\n"
	got := ParseWebAuthnOrigins(raw)
	want := []string{
		"https://app.example.com",
		"https://admin.example.com",
		"https://m.example.com",
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("ParseWebAuthnOrigins() = %#v, want %#v", got, want)
	}
}

func TestWebAuthnConfigPrimaryOrigin(t *testing.T) {
	cfg := WebAuthnConfig{
		RPOrigin: "\nhttps://app.example.com\nhttps://admin.example.com\n",
	}

	if got, want := cfg.PrimaryOrigin(), "https://app.example.com"; got != want {
		t.Fatalf("PrimaryOrigin() = %q, want %q", got, want)
	}
}
