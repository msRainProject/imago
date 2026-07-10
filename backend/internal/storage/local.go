package storage

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// DefaultLocalPathTemplate is the magic-variable template applied to local
// uploads when the operator has not configured a custom one. The template
// represents the directory layout only; the stored filename is always a
// 12-character mixed-case alphanumeric token plus the original extension.
const DefaultLocalPathTemplate = "{year}/{month}"

// LocalConfig is the storage-package view of the local driver configuration.
// It mirrors the relevant subset of config.LocalConfig and is the canonical
// surface the LocalStorage constructor consumes.
//
// PathTemplate is the magic-variable template applied at upload time to
// produce the directory portion of the storage key; the leaf filename is
// always FixedFilename(now, hash, ext). The supported set of magic variables
// is documented in renderPathTemplate. PublicBaseURL is the URL prefix the
// upload response advertises; when empty, the response uses the canonical
// pretty local URL path.
type LocalConfig struct {
	// BasePath is the on-disk root for original images.
	BasePath string
	// ThumbPath is the on-disk root for thumbnails.
	ThumbPath string
	// PathTemplate is the magic-variable template for the directory
	// portion of upload keys. When empty, DefaultLocalPathTemplate is
	// used. Templates that accidentally include filename-style pieces
	// (e.g. the legacy "{timestamp}_{random}_{hash12}{ext}" suffix) are
	// normalized: the matching trailing segment is dropped and the
	// fixed filename rule is applied.
	PathTemplate string
	// PublicBaseURL is the URL prefix for the upload response. When empty
	// the driver falls back to the in-process proxy path.
	PublicBaseURL string
}

// LocalStorage implements Storage on the local filesystem.
//
// The on-disk layout is preserved from the original implementation so existing
// deployments keep working untouched:
//
//	<basePath>/<key>            original image
//	<thumbPath>/<thumbKey>      thumbnail
//
// Keys are relative paths; the driver joins them with the configured base.
type LocalStorage struct {
	basePath  string
	thumbPath string
	// publicBase is the URL prefix the driver returns from PublicURL when
	// non-empty. Trimmed of trailing slashes in the constructor.
	publicBase string
	// dirBuilder renders the directory portion of a relative storage key
	// for a new upload. It is derived from the configured PathTemplate;
	// an empty template falls back to DefaultLocalPathTemplate. The leaf
	// filename is always produced by StoredFilename, never by the
	// template.
	dirBuilder func(filename string, hash string, now unixTime) (string, error)
}

// unixTime is the small clock surface the template renderer needs. main.go
// can construct LocalStorage without exposing the full time package.
type unixTime struct {
	Year, Month, Day int
	Timestamp        string
}

// NewLocalStorage creates a new LocalStorage, ensuring both directories exist.
func NewLocalStorage(basePath, thumbPath, proxyURLPrefix string) (*LocalStorage, error) {
	return NewLocalStorageWithConfig(LocalConfig{
		BasePath:      basePath,
		ThumbPath:     thumbPath,
		PathTemplate:  DefaultLocalPathTemplate,
		PublicBaseURL: proxyURLPrefix,
	})
}

// NewLocalStorageWithConfig creates a new LocalStorage from a LocalConfig.
// This is the preferred constructor for new callers; NewLocalStorage is
// retained for backwards compatibility with code that already passes a
// proxy URL prefix as a positional argument.
func NewLocalStorageWithConfig(cfg LocalConfig) (*LocalStorage, error) {
	if cfg.BasePath == "" {
		return nil, errors.New("local: base_path is required")
	}
	if cfg.ThumbPath == "" {
		return nil, errors.New("local: thumb_path is required")
	}
	if err := os.MkdirAll(cfg.BasePath, 0o755); err != nil {
		return nil, fmt.Errorf("create base path: %w", err)
	}
	if err := os.MkdirAll(cfg.ThumbPath, 0o755); err != nil {
		return nil, fmt.Errorf("create thumb path: %w", err)
	}

	template := cfg.PathTemplate
	if strings.TrimSpace(template) == "" {
		template = DefaultLocalPathTemplate
	}
	dirBuilder, err := compilePathTemplate(template)
	if err != nil {
		return nil, fmt.Errorf("local: path template: %w", err)
	}

	return &LocalStorage{
		basePath:   cfg.BasePath,
		thumbPath:  cfg.ThumbPath,
		publicBase: strings.TrimRight(cfg.PublicBaseURL, "/"),
		dirBuilder: dirBuilder,
	}, nil
}

// safePath joins key with base and verifies the result stays within base.
func safePath(base, key string) (string, error) {
	joined := filepath.Join(base, filepath.Clean(key))
	if !strings.HasPrefix(joined, base+string(filepath.Separator)) && joined != base {
		return "", fmt.Errorf("local: path escapes base directory: %s", key)
	}
	return joined, nil
}

// safeThumbPath joins key with thumbBase and verifies the result stays within thumbBase.
func safeThumbPath(thumbBase, key string) (string, error) {
	joined := filepath.Join(thumbBase, filepath.Clean(key))
	if !strings.HasPrefix(joined, thumbBase+string(filepath.Separator)) && joined != thumbBase {
		return "", fmt.Errorf("local: path escapes thumb directory: %s", key)
	}
	return joined, nil
}

// Driver returns the local driver identifier.
func (s *LocalStorage) Driver() string { return DriverLocal }

// Save writes a file to basePath under key.
func (s *LocalStorage) Save(_ context.Context, key string, data io.Reader, _ string) error {
	path, err := safePath(s.basePath, key)
	if err != nil {
		return err
	}
	return s.write(path, data)
}

// SaveThumb writes a thumbnail under thumbPath.
func (s *LocalStorage) SaveThumb(_ context.Context, key string, data io.Reader) error {
	path, err := safeThumbPath(s.thumbPath, key)
	if err != nil {
		return err
	}
	return s.write(path, data)
}

func (s *LocalStorage) write(dest string, data io.Reader) error {
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return fmt.Errorf("create dir: %w", err)
	}
	f, err := os.Create(dest)
	if err != nil {
		return fmt.Errorf("create file: %w", err)
	}
	if _, err := io.Copy(f, data); err != nil {
		_ = f.Close()
		return fmt.Errorf("write file: %w", err)
	}
	if err := f.Close(); err != nil {
		return fmt.Errorf("close file: %w", err)
	}
	return nil
}

// Delete removes the object. Missing files are not an error.
func (s *LocalStorage) Delete(_ context.Context, key string) error {
	path, err := safePath(s.basePath, key)
	if err != nil {
		return err
	}
	err = os.Remove(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

// DeleteThumb removes the thumbnail. Missing files are not an error.
func (s *LocalStorage) DeleteThumb(_ context.Context, key string) error {
	path, err := safeThumbPath(s.thumbPath, key)
	if err != nil {
		return err
	}
	err = os.Remove(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

// Open streams the file. Returns ErrNotFound when the file is absent.
//
// Legacy rows persisted before the storage refactor store absolute
// filesystem paths in img.Path; we accept those unchanged so existing
// deployments keep working.
func (s *LocalStorage) Open(_ context.Context, key string) (io.ReadCloser, error) {
	path, err := s.resolvePath(key)
	if err != nil {
		return nil, err
	}
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return f, nil
}

// Path returns the absolute filesystem path for an original key. It is kept
// for callers that need to read the file directly (for example the thumbnail
// generator, which has to decode the source image off disk).
func (s *LocalStorage) Path(key string) (string, error) {
	return s.resolvePath(key)
}

// resolvePath handles the legacy absolute-path Image rows transparently: when
// the stored key is already absolute we validate it stays within basePath,
// otherwise we join it with basePath and validate.
func (s *LocalStorage) resolvePath(key string) (string, error) {
	if filepath.IsAbs(key) {
		cleaned := filepath.Clean(key)
		if !strings.HasPrefix(cleaned, s.basePath+string(filepath.Separator)) && cleaned != s.basePath {
			return "", fmt.Errorf("local: absolute path escapes base directory: %s", key)
		}
		return cleaned, nil
	}
	return safePath(s.basePath, key)
}

// ThumbPath returns the absolute filesystem path for a thumbnail key.
func (s *LocalStorage) ThumbPath(key string) (string, error) {
	return safeThumbPath(s.thumbPath, key)
}

// PublicBaseURL returns the driver-specific public base URL the upload
// response should advertise.
func (s *LocalStorage) PublicBaseURL() string {
	return s.publicBase
}

func (s *LocalStorage) PrettyPublicURL(key, hash string) string {
	prefix := "/"
	if s.publicBase != "" {
		prefix = s.publicBase + "/"
	}
	if IsAPIKey(key) {
		return prefix + prettyNameFromParts(key, hash)
	}
	if year, ok := yearSegmentFromKey(key); ok {
		return prefix + year + "/" + prettyNameFromParts(key, hash)
	}
	return prefix + prettyNameFromParts(key, hash)
}

// PublicURL returns the URL the upload response should advertise for the
// given key. Local files always use the canonical pretty URL shape.
func (s *LocalStorage) PublicURL(key string) string {
	return s.PrettyPublicURL(key, hashFromKey(key))
}

// ThumbURL mirrors PublicURL for thumbnails.
func (s *LocalStorage) ThumbURL(key string) string {
	if s.publicBase != "" {
		return s.publicBase + "/" + key
	}
	hash := thumbHashFromKey(key)
	return "/api/files/" + hash + "/thumb"
}

// BuildKey renders a relative storage key for a new upload. The directory
// portion of the key is derived from the configured path template; the leaf
// filename is always FixedFilename(now, hash, ext) and is independent of the
// template. The arguments are the caller-supplied original filename (used
// to derive the file extension), the lowercase hex SHA-256 hash of the
// upload bytes, and the current time.
func (s *LocalStorage) BuildKey(filename, hash string, now unixTime) (string, error) {
	dir, err := s.dirBuilder(filename, hash, now)
	if err != nil {
		return "", err
	}
	return joinLocalKey(dir, StoredFilename(filepath.Ext(filename)))
}

// compilePathTemplate returns a directory builder for the given template.
// The builder renders the directory portion of a storage key; the leaf
// filename is appended by the caller (BuildKey) using FixedFilename. See
// renderPathTemplate for the supported magic variables.
func compilePathTemplate(template string) (func(string, string, unixTime) (string, error), error) {
	vars, err := parsePathTemplate(template)
	if err != nil {
		return nil, err
	}
	return func(filename, hash string, now unixTime) (string, error) {
		return renderPathTemplate(vars, filename, hash, now)
	}, nil
}

// joinLocalKey assembles the final "<dir>/<file>" key. The directory
// produced by the template may include filename-like segments left over
// from a legacy template (e.g. the previous default
// "{year}/{month}/{timestamp}_{random}_{hash12}{ext}"). We detect the
// fixed-filename pattern in the trailing segment and drop it, so the
// configured template is normalized to a directory path rather than
// overriding the canonical filename rule.
func joinLocalKey(dir, fixed string) (string, error) {
	if dir == "" {
		return fixed, nil
	}
	dir = strings.TrimRight(dir, "/")
	parts := strings.Split(dir, "/")
	if len(parts) > 0 && matchesFixedFilename(parts[len(parts)-1], fixed) {
		parts = parts[:len(parts)-1]
		dir = strings.Join(parts, "/")
	}
	if dir == "" {
		return fixed, nil
	}
	return dir + "/" + fixed, nil
}

// matchesFixedFilename reports whether segment equals the canonical fixed
// filename. Used to detect (and drop) filename-like segments the admin
// accidentally left in the directory template.
func matchesFixedFilename(segment, fixed string) bool {
	if segment == fixed {
		return true
	}
	// Allow for sanitisation differences: the renderer drops some
	// characters (slashes become underscores, control bytes disappear).
	// A segment that, after a single pass of slash→underscore and
	// control-byte stripping, matches the fixed filename, is treated as
	// a legacy filename segment.
	if len(segment) != len(fixed) {
		return false
	}
	for i := 0; i < len(segment); i++ {
		a, b := segment[i], fixed[i]
		switch {
		case a == b:
		case (a == '/' || a == '\\') && b == '_':
		default:
			return false
		}
	}
	return true
}

// StoredFilename returns the canonical local-storage leaf filename.
func StoredFilename(ext string) string {
	return RandomTokenN(12) + ext
}

// hashFromKey extracts the leading 12-char hash prefix from "<ts>_<rand>_<hash12>.<ext>".
// Files uploaded before the storage refactor store a full relative path like
// "2026/06/20260624..._xxxxxxxx_<hash12>.<ext>"; we only use it for the
// /api/files URL which is keyed on the SHA-256 hash stored on the Image row,
// so we fall back to a stable fragment of the filename when the layout does
// not match.
func hashFromKey(key string) string {
	base := filepath.Base(key)
	idx := strings.LastIndex(base, "_")
	if idx < 0 {
		return base
	}
	candidate := base[idx+1:]
	// Strip extension.
	if dot := strings.Index(candidate, "."); dot >= 0 {
		candidate = candidate[:dot]
	}
	return candidate
}

// thumbHashFromKey reverses "<hash>.webp" back to the hash.
func thumbHashFromKey(key string) string {
	base := filepath.Base(key)
	if dot := strings.Index(base, "."); dot >= 0 {
		return base[:dot]
	}
	return base
}

// RandomToken returns 8 alphanumeric characters sourced from crypto/rand. The upload
// path uses it to disambiguate concurrent uploads that share the same
// timestamp + hash prefix.
func RandomToken() string {
	return RandomTokenN(8)
}

// RandomTokenN returns an n-char string sourced from crypto/rand.
func RandomTokenN(n int) string {
	const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
	b := make([]byte, 1)
	out := make([]byte, n)
	for i := range out {
		if _, err := rand.Read(b); err != nil {
			return strings.Repeat("0", n)
		}
		out[i] = alphabet[int(b[0])%len(alphabet)]
	}
	return string(out)
}

func prettyNameFromParts(key, hash string) string {
	base := filepath.Base(key)
	name := strings.TrimSuffix(base, filepath.Ext(base))
	short := name
	if len(name) >= 8 {
		short = name[:8]
	}
	hashPart := hash
	if len(hashPart) > 12 {
		hashPart = hashPart[:12]
	}
	return short + hashPart
}

func yearSegmentFromKey(key string) (string, bool) {
	parts := strings.Split(filepath.ToSlash(key), "/")
	for _, part := range parts {
		if len(part) != 4 {
			continue
		}
		ok := true
		for _, ch := range part {
			if ch < '0' || ch > '9' {
				ok = false
				break
			}
		}
		if ok {
			return part, true
		}
	}
	return "", false
}

// BuildAPIKey builds a storage key for API key uploads: {appName}/{folder?}/{filename}.
// No year/month segments — the app name is the top-level directory.
func (s *LocalStorage) BuildAPIKey(appName, folder, filename string) (string, error) {
	parts := []string{appName}
	if folder != "" {
		parts = append(parts, folder)
	}
	parts = append(parts, filename)
	return filepath.ToSlash(filepath.Join(parts...)), nil
}

// IsAPIKey returns true if the storage key starts with a non-year segment,
// indicating it was uploaded via an API key (app token) rather than JWT.
func IsAPIKey(key string) bool {
	first, _, _ := strings.Cut(filepath.ToSlash(key), "/")
	if first == "" {
		return false
	}
	if len(first) == 4 {
		allDigits := true
		for _, ch := range first {
			if ch < '0' || ch > '9' {
				allDigits = false
				break
			}
		}
		if allDigits {
			return false
		}
	}
	return true
}
