package repository

import (
	"hill-images/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// APITokenRepo provides database access for APIToken entities.
type APITokenRepo struct {
	db *gorm.DB
}

// NewAPITokenRepo creates a new APITokenRepo.
func NewAPITokenRepo(db *gorm.DB) *APITokenRepo {
	return &APITokenRepo{db: db}
}

// Create inserts a new API token record.
func (r *APITokenRepo) Create(token *models.APIToken) error {
	return r.db.Create(token).Error
}

// FindByID retrieves an API token by ID.
func (r *APITokenRepo) FindByID(id uuid.UUID) (*models.APIToken, error) {
	var token models.APIToken
	if err := r.db.First(&token, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &token, nil
}

// List returns all API tokens (paginated).
func (r *APITokenRepo) List(offset, limit int) ([]models.APIToken, error) {
	var tokens []models.APIToken
	if err := r.db.Offset(offset).Limit(limit).Find(&tokens).Error; err != nil {
		return nil, err
	}
	return tokens, nil
}

// Count returns the total number of API tokens.
func (r *APITokenRepo) Count() (int64, error) {
	var count int64
	if err := r.db.Model(&models.APIToken{}).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// Delete soft-deletes an API token.
func (r *APITokenRepo) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.APIToken{}, "id = ?", id).Error
}

// FindByTokenHash retrieves an API token by its SHA-256 hash.
func (r *APITokenRepo) FindByTokenHash(hash string) (*models.APIToken, error) {
	var token models.APIToken
	if err := r.db.First(&token, "token_hash = ?", hash).Error; err != nil {
		return nil, err
	}
	return &token, nil
}

// UpdateLastUsed sets the last_used timestamp for a token.
func (r *APITokenRepo) UpdateLastUsed(id uuid.UUID) error {
	return r.db.Model(&models.APIToken{}).Where("id = ?", id).Update("last_used", gorm.Expr("datetime('now')")).Error
}
