package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// APIKey represents an app-level API key for programmatic uploads.
// Each key belongs to a user, has a human-readable app name (e.g. "BlogA"),
// and routes uploads into a separate storage namespace.
type APIKey struct {
	ID               uuid.UUID      `gorm:"type:varchar(36);primaryKey" json:"id"`
	Name             string         `gorm:"type:varchar(128);not null" json:"name"`
	UserID           uuid.UUID      `gorm:"type:varchar(36);index;not null;default:00000000-0000-0000-0000-000000000000" json:"user_id"`
	APIToken         string         `gorm:"type:varchar(128);not null" json:"-"` // raw token prefix for display, stored only for prefix matching
	TokenHash        string         `gorm:"type:varchar(64);uniqueIndex;not null" json:"-"`
	IsActive         bool           `gorm:"default:true" json:"is_active"`
	UploadCount      int64          `gorm:"default:0" json:"upload_count"`
	UploadTotalBytes int64          `gorm:"default:0" json:"upload_total_bytes"`
	LastUsed         *time.Time     `json:"last_used"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID for new API keys.
func (k *APIKey) BeforeCreate(tx *gorm.DB) error {
	if k.ID == uuid.Nil {
		k.ID = uuid.New()
	}
	return nil
}
