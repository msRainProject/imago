package storage

import "testing"

func TestSanitizePathSegment(t *testing.T) {
	ok, err := SanitizePathSegment("My Blog")
	if err != nil || ok != "My-Blog" {
		t.Fatalf("got %q %v", ok, err)
	}
	if _, err := SanitizePathSegment("../etc"); err == nil {
		t.Fatal("expected error for ..")
	}
	if _, err := SanitizePathSegment("a/b"); err == nil {
		t.Fatal("expected error for slash")
	}
}

func TestSanitizeFolderPath(t *testing.T) {
	ok, err := SanitizeFolderPath("posts/2026")
	if err != nil || ok != "posts/2026" {
		t.Fatalf("got %q %v", ok, err)
	}
	if _, err := SanitizeFolderPath("../../etc/passwd"); err == nil {
		t.Fatal("expected error")
	}
	empty, err := SanitizeFolderPath("")
	if err != nil || empty != "" {
		t.Fatalf("empty: %q %v", empty, err)
	}
}
