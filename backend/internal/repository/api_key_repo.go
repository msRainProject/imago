package repository

import (
	"hill-images/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// APIKeyRepo provides database access for APIKey entities.
type APIKeyRepo struct {
	db *gorm.DB
}

// NewAPIKeyRepo creates a new APIKeyRepo.
func NewAPIKeyRepo(db *gorm.DB) *APIKeyRepo {
	return &APIKeyRepo{db: db}
}

// Create inserts a new API key record.
func (r *APIKeyRepo) Create(key *models.APIKey) error {
	return r.db.Create(key).Error
}

// FindByID retrieves an API key by ID.
func (r *APIKeyRepo) FindByID(id uuid.UUID) (*models.APIKey, error) {
	var key models.APIKey
	if err := r.db.First(&key, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &key, nil
}

// FindByTokenHash retrieves an API key by its SHA-256 hash.
func (r *APIKeyRepo) FindByTokenHash(hash string) (*models.APIKey, error) {
	var key models.APIKey
	if err := r.db.Where("token_hash = ? AND is_active = ?", hash, true).First(&key).Error; err != nil {
		return nil, err
	}
	return &key, nil
}

// ListByUserID returns all API keys for a user.
func (r *APIKeyRepo) ListByUserID(userID uuid.UUID) ([]models.APIKey, error) {
	var keys []models.APIKey
	if err := r.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&keys).Error; err != nil {
		return nil, err
	}
	return keys, nil
}

// Delete soft-deletes an API key.
func (r *APIKeyRepo) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.APIKey{}, "id = ?", id).Error
}

// UpdateLastUsed sets the last_used timestamp for a key.
func (r *APIKeyRepo) UpdateLastUsed(id uuid.UUID) error {
	return r.db.Model(&models.APIKey{}).Where("id = ?", id).Updates(map[string]interface{}{
		"last_used": gorm.Expr("datetime('now')"),
	}).Error
}

// IncrementUploadStats increments the upload count and total bytes for a key.
func (r *APIKeyRepo) IncrementUploadStats(id uuid.UUID, bytes int64) error {
	return r.db.Model(&models.APIKey{}).Where("id = ?", id).Updates(map[string]interface{}{
		"upload_count":       gorm.Expr("upload_count + 1"),
		"upload_total_bytes": gorm.Expr("upload_total_bytes + ?", bytes),
		"last_used":          gorm.Expr("datetime('now')"),
	}).Error
}
