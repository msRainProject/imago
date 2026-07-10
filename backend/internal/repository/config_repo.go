package repository

import (
	"strings"

	"hill-images/internal/config"
	"hill-images/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ConfigRepo provides database access for ConfigEntry entities.
type ConfigRepo struct {
	db *gorm.DB
}

// NewConfigRepo creates a new ConfigRepo.
func NewConfigRepo(db *gorm.DB) *ConfigRepo {
	return &ConfigRepo{db: db}
}

// List returns all config entries.
func (r *ConfigRepo) List() ([]models.ConfigEntry, error) {
	var entries []models.ConfigEntry
	if err := r.db.Find(&entries).Error; err != nil {
		return nil, err
	}
	return entries, nil
}

// FindByKey retrieves a config entry by key.
func (r *ConfigRepo) FindByKey(key string) (*models.ConfigEntry, error) {
	var entry models.ConfigEntry
	if err := r.db.First(&entry, "key = ?", key).Error; err != nil {
		return nil, err
	}
	return &entry, nil
}

// Upsert creates or updates a config entry.
func (r *ConfigRepo) Upsert(entry *models.ConfigEntry) error {
	return r.db.Save(entry).Error
}

// Delete removes a config entry by ID.
func (r *ConfigRepo) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.ConfigEntry{}, "id = ?", id).Error
}

// SeedDefaults populates the config_entries table with values from the
// application config.yaml. Existing rows are never overwritten — the DB
// value is the source of truth once a user has edited it.
func (r *ConfigRepo) SeedDefaults(cfg *config.Config) {
	defaults := map[string]string{
		"title":                         "Hill Images",
		"domain":                        cfg.WebAuthn.RPOrigin,
		"imgurl":                        cfg.WebAuthn.RPOrigin,
		"maxSize":                       "10485760",
		"allowedExt":                    "jpg,jpeg,png,gif,bmp,webp,ico,heic,heif,dng",
		"upload.process.enabled":        "true",
		"upload.process.target_format":  "original",
		"upload.process.max_size_mb":    "1",
		"upload.process.max_width":      "2560",
		"upload.process.max_height":     "2560",
		"storage.driver":                cfg.Storage.Driver,
		"storage.path":                  cfg.Server.StaticPath,
		"storage.local.path_template":   cfg.Storage.Local.PathTemplate,
		"storage.local.public_base_url": cfg.Storage.Local.PublicBaseURL,
		"upyun.bucket":                  cfg.Storage.Upyun.Bucket,
		"upyun.operator":                cfg.Storage.Upyun.Operator,
		"upyun.password":                cfg.Storage.Upyun.Password,
		"upyun.endpoint":                cfg.Storage.Upyun.Endpoint,
		"upyun.domain":                  "",
		"r2.account_id":                 cfg.Storage.R2.AccountID,
		"r2.bucket":                     cfg.Storage.R2.Bucket,
		"r2.access_key_id":              cfg.Storage.R2.AccessKeyID,
		"r2.secret_access_key":          cfg.Storage.R2.SecretAccessKey,
		"r2.public_base_url":            cfg.Storage.R2.PublicBaseURL,
		"r2.region":                     cfg.Storage.R2.Region,
		"s3.endpoint":                   cfg.Storage.S3.Endpoint,
		"s3.region":                     cfg.Storage.S3.Region,
		"s3.bucket":                     cfg.Storage.S3.Bucket,
		"s3.access_key_id":              cfg.Storage.S3.AccessKeyID,
		"s3.secret_access_key":          cfg.Storage.S3.SecretAccessKey,
		"s3.public_base_url":            cfg.Storage.S3.PublicBaseURL,
		"s3.key_prefix":                 cfg.Storage.S3.KeyPrefix,
		"s3.thumb_prefix":               cfg.Storage.S3.ThumbPrefix,
		"s3.use_path_style":             map[bool]string{true: "true", false: "false"}[cfg.Storage.S3.UsePathStyle],
		"webauthn.rpid":                 cfg.WebAuthn.RPID,
		"webauthn.rporigin":             cfg.WebAuthn.RPOrigin,
		"webauthn.rpname":               cfg.WebAuthn.RPName,
	}

	for key, value := range defaults {
		var count int64
		r.db.Model(&models.ConfigEntry{}).Where("key = ?", key).Count(&count)
		if count == 0 {
			entry := &models.ConfigEntry{Key: key, Value: value}
			_ = r.Upsert(entry)
		}
	}
}

// ApplyRuntimeOverrides applies persisted admin settings that are needed while
// constructing long-lived services. These values are seeded from config.yaml on
// first boot, but once edited in the admin UI the database row should win.
func (r *ConfigRepo) ApplyRuntimeOverrides(cfg *config.Config) error {
	entries, err := r.List()
	if err != nil {
		return err
	}

	for _, entry := range entries {
		value := strings.TrimSpace(entry.Value)
		if value == "" {
			continue
		}

		switch entry.Key {
		case "webauthn.rpid":
			cfg.WebAuthn.RPID = value
		case "webauthn.rporigin":
			cfg.WebAuthn.RPOrigin = value
		case "webauthn.rpname":
			cfg.WebAuthn.RPName = value
		}
	}

	return nil
}

// ResolveWebAuthnConfig returns the effective WebAuthn config for runtime use:
// start with the supplied fallback, then override it from config_entries.
func (r *ConfigRepo) ResolveWebAuthnConfig(fallback config.WebAuthnConfig) (config.WebAuthnConfig, error) {
	cfg := fallback

	entries, err := r.List()
	if err != nil {
		return cfg, err
	}

	for _, entry := range entries {
		value := strings.TrimSpace(entry.Value)
		if value == "" {
			continue
		}

		switch entry.Key {
		case "webauthn.rpid":
			cfg.RPID = value
		case "webauthn.rporigin":
			cfg.RPOrigin = value
		case "webauthn.rpname":
			cfg.RPName = value
		}
	}

	return cfg, nil
}
