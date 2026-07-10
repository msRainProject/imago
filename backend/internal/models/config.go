package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ConfigEntry represents a key-value application configuration stored in the database.
type ConfigEntry struct {
	ID        uuid.UUID      `gorm:"type:varchar(36);primaryKey" json:"id"`
	Key       string         `gorm:"type:varchar(128);uniqueIndex;not null" json:"key"`
	Value     string         `gorm:"type:text" json:"value"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID for new config entries.
func (c *ConfigEntry) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}
