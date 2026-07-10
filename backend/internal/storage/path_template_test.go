package storage

import (
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestParsePathTemplate_RejectsUnknown(t *testing.T) {
	cases := []struct {
		name     string
		template string
		wantErr  bool
	}{
		{"default", DefaultLocalPathTemplate, false},
		{"empty", "", true},
		{"unknown", "{year}/{nope}", true},
		{"unterminated", "{year", true},
		{"empty placeholder", "{}", true},
		{"only literal", "static/path", false},
		{"brace in literal", "ab}c", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := parsePathTemplate(tc.template)
			if tc.wantErr && err == nil {
				t.Fatalf("expected error, got nil")
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

func TestRenderPathTemplate_DefaultLayout(t *testing.T) {
	now := NowFromTime(time.Date(2026, 6, 24, 15, 4, 5, 0, time.UTC))
	segments, err := parsePathTemplate(DefaultLocalPathTemplate)
	if err != nil {
		t.Fatalf("parse default: %v", err)
	}
	got, err := renderPathTemplate(segments, "photo.JPG", "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789", now)
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	if got != "2026/06" {
		t.Fatalf("expected year/month directory %q, got %q", "2026/06", got)
	}
}

func TestRenderPathTemplate_RejectsBadInput(t *testing.T) {
	cases := []struct {
		name     string
		template string
	}{
		{"empty result", "////"},
		{"absolute path", "/etc/passwd"},
	}
	now := NowFromTime(time.Date(2026, 6, 24, 0, 0, 0, 0, time.UTC))
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			segments, err := parsePathTemplate(tc.template)
			if err != nil {
				return
			}
			_, err = renderPathTemplate(segments, "f.jpg", "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789", now)
			if err == nil {
				t.Fatalf("expected error, got nil")
			}
		})
	}
}

func TestRenderPathTemplate_OriginalSanitised(t *testing.T) {
	now := NowFromTime(time.Date(2026, 6, 24, 0, 0, 0, 0, time.UTC))
	segments, err := parsePathTemplate("{original}")
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	got, err := renderPathTemplate(segments, "../etc/passwd", "h", now)
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	// "../" is collapsed to "_" and the leading ".." cannot form a path
	// segment on its own, so the result is a single safe filename that,
	// joined with the storage base, resolves inside the base directory.
	cleaned := filepath.ToSlash(filepath.Clean(got))
	if cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		t.Fatalf("expected a safe in-base filename, got %q (cleaned %q)", got, cleaned)
	}
}

func TestRenderPathTemplate_StripsParentTraversal(t *testing.T) {
	now := NowFromTime(time.Date(2026, 6, 24, 0, 0, 0, 0, time.UTC))
	segments, err := parsePathTemplate("static/../{hash12}{ext}")
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	got, err := renderPathTemplate(segments, "x.jpg", "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789", now)
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	// ../ is stripped at sanitisation time so the result is a clean
	// subpath under the storage base.
	if strings.HasPrefix(got, "..") || strings.Contains(got, "../") {
		t.Fatalf("expected traversal segments stripped, got %q", got)
	}
}

func TestCompilePathTemplate_RoundTrip(t *testing.T) {
	builder, err := compilePathTemplate("{year}/{month}")
	if err != nil {
		t.Fatalf("compile: %v", err)
	}
	now := NowFromTime(time.Date(2030, 1, 2, 0, 0, 0, 0, time.UTC))
	got, err := builder("x.png", "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789", now)
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if got != "2030/01" {
		t.Fatalf("expected directory %q, got %q", "2030/01", got)
	}
}

func TestLocalStorage_PublicURL_DriverAware(t *testing.T) {
	t.Run("with public base uses public url", func(t *testing.T) {
		store, err := NewLocalStorageWithConfig(LocalConfig{
			BasePath:      t.TempDir(),
			ThumbPath:     t.TempDir(),
			PublicBaseURL: "https://img.example.com",
		})
		if err != nil {
			t.Fatalf("new: %v", err)
		}
		got := store.PublicURL("2026/06/20260624_x_abcd1234abcd.jpg")
		want := "https://img.example.com/2026/20260624abcd1234abcd"
		if got != want {
			t.Fatalf("PublicURL = %q, want %q", got, want)
		}
	})

	t.Run("without public base uses pretty url", func(t *testing.T) {
		store, err := NewLocalStorageWithConfig(LocalConfig{
			BasePath:  t.TempDir(),
			ThumbPath: t.TempDir(),
		})
		if err != nil {
			t.Fatalf("new: %v", err)
		}
		got := store.PublicURL("2026/06/20260624_x_abcd1234abcd.jpg")
		want := "/2026/20260624abcd1234abcd"
		if got != want {
			t.Fatalf("expected pretty url %q, got %q", want, got)
		}
	})

	t.Run("trailing slash on public base is trimmed", func(t *testing.T) {
		store, err := NewLocalStorageWithConfig(LocalConfig{
			BasePath:      t.TempDir(),
			ThumbPath:     t.TempDir(),
			PublicBaseURL: "https://img.example.com/",
		})
		if err != nil {
			t.Fatalf("new: %v", err)
		}
		got := store.PublicURL("2026/06/20260624_x_abcd1234abcd.jpg")
		if strings.Contains(got, "//2026") {
			t.Fatalf("expected single slash, got %q", got)
		}
	})
}

func TestLocalStorage_BuildKey_UsesTemplate(t *testing.T) {
	store, err := NewLocalStorageWithConfig(LocalConfig{
		BasePath:     t.TempDir(),
		ThumbPath:    t.TempDir(),
		PathTemplate: "{year}/{month}/{day}",
	})
	if err != nil {
		t.Fatalf("new: %v", err)
	}
	now := NowFromTime(time.Date(2026, 6, 24, 0, 0, 0, 0, time.UTC))
	got, err := store.BuildKey("photo.jpg", "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789", now)
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	// The template renders to a directory only; the leaf filename is the
	// canonical 12-char random token plus the original extension.
	if !strings.HasPrefix(got, "2026/06/24/") {
		t.Fatalf("expected day directory prefix, got %q", got)
	}
	base := got[len("2026/06/24/"):]
	if len(base) != len("abcdefghijkl.jpg") {
		t.Fatalf("expected 12-char random token plus .jpg, got %q", base)
	}
	if !strings.HasSuffix(base, ".jpg") {
		t.Fatalf("expected .jpg suffix, got %q", base)
	}
}

func TestLocalStorage_BuildKey_FixedFilenameIndependence(t *testing.T) {
	cases := []struct {
		name     string
		template string
		wantDir  string
	}{
		{"default", DefaultLocalPathTemplate, "2026/06"},
		{"day", "{year}/{month}/{day}", "2026/06/24"},
		{"static", "static", "static"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			store, err := NewLocalStorageWithConfig(LocalConfig{
				BasePath:     t.TempDir(),
				ThumbPath:    t.TempDir(),
				PathTemplate: tc.template,
			})
			if err != nil {
				t.Fatalf("new: %v", err)
			}
			now := NowFromTime(time.Date(2026, 6, 24, 0, 0, 0, 0, time.UTC))
			got, err := store.BuildKey("photo.jpg", "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789", now)
			if err != nil {
				t.Fatalf("build: %v", err)
			}
			if !strings.HasPrefix(got, tc.wantDir+"/") {
				t.Fatalf("expected directory prefix %q, got %q", tc.wantDir, got)
			}
			leaf := got
			if i := strings.LastIndex(got, "/"); i >= 0 {
				leaf = got[i+1:]
			}
			if len(leaf) != len("abcdefghijkl.jpg") {
				t.Fatalf("expected 12-char random token plus .jpg, got leaf %q", leaf)
			}
			if !strings.HasSuffix(leaf, ".jpg") {
				t.Fatalf("expected .jpg suffix, got %q", leaf)
			}
		})
	}
}

func TestLocalStorage_BuildKey_NormalizesLegacyFilenameSegment(t *testing.T) {
	// Legacy default from the previous refactor; the admin's
	// configuration still parses, but the trailing filename-like
	// segment is normalized to a directory.
	store, err := NewLocalStorageWithConfig(LocalConfig{
		BasePath:     t.TempDir(),
		ThumbPath:    t.TempDir(),
		PathTemplate: "{year}/{month}/{timestamp}_{random}_{hash12}{ext}",
	})
	if err != nil {
		t.Fatalf("new: %v", err)
	}
	now := NowFromTime(time.Date(2026, 6, 24, 0, 0, 0, 0, time.UTC))
	got, err := store.BuildKey("photo.jpg", "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789", now)
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	// The legacy "{timestamp}_{random}_{hash12}{ext}" tail is dropped
	// and the canonical 12-char random leaf filename is appended.
	if !strings.HasPrefix(got, "2026/06/") {
		t.Fatalf("expected year/month directory prefix, got %q", got)
	}
	leaf := got[strings.LastIndex(got, "/")+1:]
	if len(leaf) != len("abcdefghijkl.jpg") || !strings.HasSuffix(leaf, ".jpg") {
		t.Fatalf("expected 12-char random leaf plus .jpg, got %q", leaf)
	}
}

func TestNewLocalStorageWithConfig_RejectsBadTemplate(t *testing.T) {
	_, err := NewLocalStorageWithConfig(LocalConfig{
		BasePath:     t.TempDir(),
		ThumbPath:    t.TempDir(),
		PathTemplate: "{nope}",
	})
	if err == nil {
		t.Fatalf("expected error for unknown variable")
	}
}
