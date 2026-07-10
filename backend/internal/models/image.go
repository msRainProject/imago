package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Image struct {
	ID            uuid.UUID      `gorm:"type:varchar(36);primaryKey" json:"id"`
	UserID        uuid.UUID      `gorm:"type:varchar(36);index;not null" json:"user_id"`
	Hash          string         `gorm:"type:varchar(64);uniqueIndex;not null" json:"hash"`
	Filename      string         `gorm:"type:varchar(255);not null" json:"filename"`
	OriginalName  string         `gorm:"type:varchar(255);not null" json:"original_name"`
	Path          string         `gorm:"type:varchar(512);not null" json:"path"`
	ThumbPath     string         `gorm:"type:varchar(512)" json:"thumb_path"`
	Size          int64          `gorm:"type:integer;default:0" json:"size"`
	MimeType      string         `gorm:"type:varchar(64)" json:"mime_type"`
	Width         int            `gorm:"type:integer;default:0" json:"width"`
	Height        int            `gorm:"type:integer;default:0" json:"height"`
	StorageDriver string         `gorm:"type:varchar(16);default:'local'" json:"storage_driver"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

func (img *Image) BeforeCreate(tx *gorm.DB) error {
	if img.ID == uuid.Nil {
		img.ID = uuid.New()
	}
	return nil
}
