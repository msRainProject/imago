package repository

import (
	"testing"

	"hill-images/internal/models"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestImageRepoSearchesDisplayAndOriginalNames(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:image-repo-search?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.Image{}); err != nil {
		t.Fatalf("migrate images: %v", err)
	}

	owner := uuid.New()
	otherOwner := uuid.New()
	images := []*models.Image{
		{UserID: owner, Hash: "hash-display", Filename: "renamed-sunrise.jpg", OriginalName: "camera-001.jpg", Path: "a.jpg"},
		{UserID: owner, Hash: "hash-original", Filename: "stored-b.jpg", OriginalName: "family-sunset.png", Path: "b.png"},
		{UserID: otherOwner, Hash: "hash-other", Filename: "renamed-sunrise-other.jpg", OriginalName: "other.jpg", Path: "c.jpg"},
	}
	for _, img := range images {
		if err := db.Create(img).Error; err != nil {
			t.Fatalf("create image: %v", err)
		}
	}

	repo := NewImageRepo(db)
	displayMatches, err := repo.SearchByUserID(owner, "sunrise", 0, 20)
	if err != nil {
		t.Fatalf("search display name: %v", err)
	}
	if len(displayMatches) != 1 || displayMatches[0].Hash != "hash-display" {
		t.Fatalf("unexpected display-name matches: %#v", displayMatches)
	}

	originalMatches, err := repo.SearchByUserID(owner, "sunset", 0, 20)
	if err != nil {
		t.Fatalf("search original name: %v", err)
	}
	if len(originalMatches) != 1 || originalMatches[0].Hash != "hash-original" {
		t.Fatalf("unexpected original-name matches: %#v", originalMatches)
	}

	count, err := repo.CountSearchByUserID(owner, "sunrise")
	if err != nil {
		t.Fatalf("count owner matches: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one owner match, got %d", count)
	}

	allMatches, err := repo.SearchAll("sunrise", 0, 20)
	if err != nil {
		t.Fatalf("search all: %v", err)
	}
	if len(allMatches) != 2 {
		t.Fatalf("expected two global matches, got %d", len(allMatches))
	}
}
