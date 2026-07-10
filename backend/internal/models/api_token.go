package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// APIToken represents an API access token with SHA256-hashed secret.
type APIToken struct {
	ID        uuid.UUID      `gorm:"type:varchar(36);primaryKey" json:"id"`
	UserID    uuid.UUID      `gorm:"type:varchar(36);index;not null;default:00000000-0000-0000-0000-000000000000" json:"user_id"`
	Name      string         `gorm:"type:varchar(128);not null" json:"name"`
	TokenHash string         `gorm:"type:varchar(64);uniqueIndex;not null" json:"-"`
	LastUsed  *time.Time     `json:"last_used"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID for new API tokens.
func (t *APIToken) BeforeCreate(tx *gorm.DB) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	return nil
}
