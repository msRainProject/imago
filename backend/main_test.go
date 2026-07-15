package main

import (
	"path/filepath"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestMigrateImageHashIndexDropsLegacyUniqueIndex(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "test.db")), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.Exec(`CREATE TABLE images (id INTEGER PRIMARY KEY, user_id INTEGER, hash TEXT)`).Error; err != nil {
		t.Fatalf("create images table: %v", err)
	}
	if err := db.Exec(`CREATE UNIQUE INDEX idx_images_hash ON images(hash)`).Error; err != nil {
		t.Fatalf("create legacy index: %v", err)
	}

	migrateImageHashIndex(db)

	var count int64
	if err := db.Raw(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_images_hash'`).Scan(&count).Error; err != nil {
		t.Fatalf("query legacy index: %v", err)
	}
	if count != 0 {
		t.Fatalf("legacy index still exists")
	}
}
