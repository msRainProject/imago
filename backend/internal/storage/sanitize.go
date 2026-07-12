package storage

import (
	"fmt"
	"path/filepath"
	"strings"
	"unicode"
)

// SanitizePathSegment validates a single storage path segment (app name, folder
// component, etc.). It rejects empty values, path separators, parent references,
// absolute paths, and control characters. Allowed characters are letters,
// digits, and the set . _ - (spaces collapse to '-').
func SanitizePathSegment(raw string) (string, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return "", fmt.Errorf("empty path segment")
	}
	if len(s) > 128 {
		return "", fmt.Errorf("path segment too long")
	}
	// Reject any path-like input before cleaning so ".." cannot hide inside.
	if strings.ContainsAny(s, `/\\`) || strings.Contains(s, "..") {
		return "", fmt.Errorf("path segment must not contain separators or ..")
	}
	if filepath.IsAbs(s) {
		return "", fmt.Errorf("path segment must not be absolute")
	}
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			b.WriteRune(r)
		case r == '.' || r == '_' || r == '-':
			b.WriteRune(r)
		case r == ' ':
			b.WriteByte('-')
		default:
			return "", fmt.Errorf("path segment contains invalid character %q", r)
		}
	}
	out := b.String()
	out = strings.Trim(out, ".-_")
	if out == "" || out == "." || out == ".." {
		return "", fmt.Errorf("path segment invalid after sanitization")
	}
	return out, nil
}

// SanitizeFolderPath validates a multi-segment folder query like "posts/2026".
// Each segment is sanitized independently; empty input means "no folder".
func SanitizeFolderPath(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", nil
	}
	raw = strings.ReplaceAll(raw, `\`, `/`)
	parts := strings.Split(raw, "/")
	clean := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		seg, err := SanitizePathSegment(part)
		if err != nil {
			return "", err
		}
		clean = append(clean, seg)
	}
	if len(clean) == 0 {
		return "", nil
	}
	if len(clean) > 8 {
		return "", fmt.Errorf("folder path too deep")
	}
	return strings.Join(clean, "/"), nil
}
