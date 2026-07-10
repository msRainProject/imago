package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Token represents a refresh or access token record for session management.
type Token struct {
	ID        uuid.UUID      `gorm:"type:varchar(36);primaryKey" json:"id"`
	UserID    uuid.UUID      `gorm:"type:varchar(36);index;not null" json:"user_id"`
	TokenHash string         `gorm:"type:varchar(255);uniqueIndex;not null" json:"-"`
	Type      string         `gorm:"type:varchar(16);not null" json:"type"`
	ExpiresAt time.Time      `gorm:"not null" json:"expires_at"`
	Revoked   bool           `gorm:"default:false" json:"revoked"`
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID for new tokens.
func (t *Token) BeforeCreate(tx *gorm.DB) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	return nil
}

const (
	TokenTypeAccess  = "access"
	TokenTypeRefresh = "refresh"
)
