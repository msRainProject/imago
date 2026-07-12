package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/viper"
)

// Config holds all application configuration.
type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Database DatabaseConfig `mapstructure:"database"`
	JWT      JWTConfig      `mapstructure:"jwt"`
	WebAuthn WebAuthnConfig `mapstructure:"webauthn"`
	Storage  StorageConfig  `mapstructure:"storage"`
}

type ServerConfig struct {
	Host       string `mapstructure:"host"`
	Port       int    `mapstructure:"port"`
	StaticPath string `mapstructure:"static_path"`
	ThumbPath  string `mapstructure:"thumb_path"`
	UploadPath string `mapstructure:"upload_path"`
}

type DatabaseConfig struct {
	Path string `mapstructure:"path"`
}

type JWTConfig struct {
	Secret      string `mapstructure:"secret"`
	ExpiryHours int    `mapstructure:"expiry_hours"`
}

type WebAuthnConfig struct {
	RPID     string `mapstructure:"rp_id"`
	RPName   string `mapstructure:"rp_name"`
	RPOrigin string `mapstructure:"rp_origin"`
}

// Origins expands RPOrigin into a normalized origin list. Admin settings may
// store multiple origins separated by newlines, commas, or semicolons.
func (c WebAuthnConfig) Origins() []string {
	return ParseWebAuthnOrigins(c.RPOrigin)
}

// PrimaryOrigin returns the first configured origin, or an empty string when
// no valid origin is configured.
func (c WebAuthnConfig) PrimaryOrigin() string {
	origins := c.Origins()
	if len(origins) == 0 {
		return ""
	}
	return origins[0]
}

// ParseWebAuthnOrigins normalizes a raw admin-config string into a deduplicated
// list of origins while preserving input order.
func ParseWebAuthnOrigins(raw string) []string {
	parts := strings.FieldsFunc(raw, func(r rune) bool {
		return r == '\n' || r == '\r' || r == ',' || r == ';'
	})

	seen := make(map[string]struct{}, len(parts))
	origins := make([]string, 0, len(parts))
	for _, part := range parts {
		origin := strings.TrimSpace(part)
		if origin == "" {
			continue
		}
		if _, ok := seen[origin]; ok {
			continue
		}
		seen[origin] = struct{}{}
		origins = append(origins, origin)
	}

	return origins
}

// StorageConfig selects and configures the storage backend. The driver name
// must be one of the values exposed by the storage package (storage.DriverLocal,
// storage.DriverR2, or storage.DriverS3). Upyun is kept for backwards
// compatibility with the config file but its adapter is a stub and is not
// wired in main.go.
type StorageConfig struct {
	Driver string      `mapstructure:"driver"`
	Local  LocalConfig `mapstructure:"local"`
	Upyun  UpyunConfig `mapstructure:"upyun"`
	R2     R2Config    `mapstructure:"r2"`
	S3     S3Config    `mapstructure:"s3"`
}

// LocalConfig holds the local filesystem driver configuration. Local owns its
// own image access domain (PublicBaseURL) and its own path template
// (PathTemplate) so cloud and local drivers can be configured independently.
//
// PathTemplate supports a small set of magic variables, expanded at upload
// time by the storage package; see storage.LocalStorage for the supported
// set. The template renders the DIRECTORY portion of the storage key; the
// leaf filename is always "<timestamp>_<random>_<hash12><ext>" and is
// independent of the template. The template is relative to
// Server.StaticPath; leading and trailing slashes are tolerated. A template
// that resolves to an empty path, to a path containing "..", or to a path
// that resolves outside StaticPath is rejected at upload time.
type LocalConfig struct {
	// PathTemplate is the magic-variable template used to build the
	// directory portion of per-upload relative keys. Default:
	// "{year}/{month}". The leaf filename is appended automatically as
	// "<timestamp>_<random>_<hash12><ext>"; a template that accidentally
	// includes filename-style pieces is normalized to a directory path.
	PathTemplate string `mapstructure:"path_template"`
	// PublicBaseURL is the URL prefix the upload response advertises for
	// local files. When empty, the response uses the canonical pretty
	// local URL path. The driver-specific key (here) takes precedence over
	// the legacy global "imgurl" / "domain" settings.
	PublicBaseURL string `mapstructure:"public_base_url"`
}

type UpyunConfig struct {
	Bucket   string `mapstructure:"bucket"`
	Operator string `mapstructure:"operator"`
	Password string `mapstructure:"password"`
	Endpoint string `mapstructure:"endpoint"`
}

// R2Config holds the Cloudflare R2 driver settings. The field names map to
// the storage.r2.* block in config.yaml and the storage.r2.* keys persisted
// in the admin config_entries table.
type R2Config struct {
	AccountID       string `mapstructure:"account_id"`
	Bucket          string `mapstructure:"bucket"`
	AccessKeyID     string `mapstructure:"access_key_id"`
	SecretAccessKey string `mapstructure:"secret_access_key"`
	PublicBaseURL   string `mapstructure:"public_base_url"`
	Region          string `mapstructure:"region"`
}

// S3Config holds the generic S3-compatible storage driver settings. The field
// names map to the storage.s3.* block in config.yaml and the storage.s3.*
// keys persisted in the admin config_entries table.
//
// This driver works with any S3-compatible service: AWS S3, Cloudflare R2,
// MinIO, Backblaze B2, DigitalOcean Spaces, etc.
type S3Config struct {
	Endpoint        string `mapstructure:"endpoint"`
	Region          string `mapstructure:"region"`
	Bucket          string `mapstructure:"bucket"`
	AccessKeyID     string `mapstructure:"access_key_id"`
	SecretAccessKey string `mapstructure:"secret_access_key"`
	PublicBaseURL   string `mapstructure:"public_base_url"`
	KeyPrefix       string `mapstructure:"key_prefix"`
	ThumbPrefix     string `mapstructure:"thumb_prefix"`
	UsePathStyle    bool   `mapstructure:"use_path_style"`
}

// knownWeakJWTSecrets are placeholder values that must never ship to production.
var knownWeakJWTSecrets = map[string]struct{}{
	"":                             {},
	"CHANGE_ME_TO_RANDOM_64_CHARS": {},
	"change_me":                    {},
	"secret":                       {},
	"jwt_secret":                   {},
	"your-secret-here":             {},
	"changeme":                     {},
}

// ValidateJWTSecret rejects empty, short, or known-placeholder signing keys.
// HS256 secrets shorter than 32 bytes are considered too weak for production.
func ValidateJWTSecret(secret string) error {
	trimmed := strings.TrimSpace(secret)
	if _, weak := knownWeakJWTSecrets[trimmed]; weak {
		return fmt.Errorf("jwt.secret is empty or a known placeholder — set a random value of at least 32 characters in config.yaml")
	}
	if len(trimmed) < 32 {
		return fmt.Errorf("jwt.secret must be at least 32 characters (got %d)", len(trimmed))
	}
	lower := strings.ToLower(trimmed)
	for weak := range knownWeakJWTSecrets {
		if weak != "" && strings.ToLower(weak) == lower {
			return fmt.Errorf("jwt.secret is a known placeholder — set a random value of at least 32 characters in config.yaml")
		}
	}
	if strings.Contains(lower, "change_me") || strings.Contains(lower, "changeme") {
		return fmt.Errorf("jwt.secret looks like a placeholder — set a random value of at least 32 characters in config.yaml")
	}
	return nil
}

// Load reads config.yaml from the directory containing the running binary,
// falling back to the current working directory.
func Load() (*Config, error) {
	v := viper.New()

	v.SetConfigName("config")
	v.SetConfigType("yaml")

	// Priority: binary dir, then cwd
	if exePath, err := os.Executable(); err == nil {
		v.AddConfigPath(filepath.Dir(exePath))
	}
	v.AddConfigPath(".")

	v.SetDefault("server.host", "0.0.0.0")
	v.SetDefault("server.port", 8080)
	v.SetDefault("database.path", "hill.db")
	v.SetDefault("jwt.expiry_hours", 24)
	v.SetDefault("storage.driver", "local")
	v.SetDefault("storage.local.path_template", "{year}/{month}")
	v.SetDefault("storage.local.public_base_url", "")

	if err := v.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config: %w", err)
	}

	if err := ValidateJWTSecret(cfg.JWT.Secret); err != nil {
		return nil, err
	}
	if cfg.JWT.ExpiryHours < 1 {
		cfg.JWT.ExpiryHours = 24
	}

	return &cfg, nil
}

// EnsureDBDir creates the parent directory for the SQLite database file
// if it does not already exist.
func EnsureDBDir(dbPath string) error {
	dir := filepath.Dir(dbPath)
	if dir == "" || dir == "." {
		return nil
	}
	return os.MkdirAll(dir, 0o755)
}
