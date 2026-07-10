package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// JWTBlacklist represents a revoked JWT token.
type JWTBlacklist struct {
	ID        uuid.UUID      `gorm:"type:varchar(36);primaryKey" json:"id"`
	TokenJTI  string         `gorm:"type:varchar(36);uniqueIndex;not null" json:"token_jti"`
	ExpiresAt time.Time      `gorm:"not null;index" json:"expires_at"`
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID for new blacklist entries.
func (j *JWTBlacklist) BeforeCreate(tx *gorm.DB) error {
	if j.ID == uuid.Nil {
		j.ID = uuid.New()
	}
	return nil
}
