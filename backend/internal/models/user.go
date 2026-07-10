package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// User represents an authenticated user in the system.
type User struct {
	ID                  uuid.UUID      `gorm:"type:varchar(36);primaryKey" json:"id"`
	Username            string         `gorm:"type:varchar(64);uniqueIndex;not null" json:"username"`
	DisplayName         string         `gorm:"type:varchar(128);default:''" json:"display_name"`
	PasswordHash        string         `gorm:"type:varchar(255);not null" json:"-"`
	Role                string         `gorm:"type:varchar(16);default:'user';not null" json:"role"`
	WebAuthnID          []byte         `gorm:"type:blob" json:"-"`
	WebAuthnCredentials []byte         `gorm:"type:text" json:"-"`
	LastLoginAt         *time.Time     `json:"last_login_at,omitempty"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID for new users.
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}

// IsAdmin returns true if the user has the admin role.
func (u *User) IsAdmin() bool {
	return u.Role == "admin"
}
