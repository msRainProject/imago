package repository

import (
	"hill-images/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TokenRepo provides database access for Token entities.
type TokenRepo struct {
	db *gorm.DB
}

// NewTokenRepo creates a new TokenRepo.
func NewTokenRepo(db *gorm.DB) *TokenRepo {
	return &TokenRepo{db: db}
}

// Create inserts a new token record.
func (r *TokenRepo) Create(token *models.Token) error {
	return r.db.Create(token).Error
}

// FindByTokenHash retrieves a token by its hash.
func (r *TokenRepo) FindByTokenHash(hash string) (*models.Token, error) {
	var token models.Token
	if err := r.db.First(&token, "token_hash = ?", hash).Error; err != nil {
		return nil, err
	}
	return &token, nil
}

// Revoke marks a token as revoked.
func (r *TokenRepo) Revoke(id uuid.UUID) error {
	return r.db.Model(&models.Token{}).Where("id = ?", id).Update("revoked", true).Error
}

// RevokeAllByUser revokes all tokens for a user.
func (r *TokenRepo) RevokeAllByUser(userID uuid.UUID) error {
	return r.db.Model(&models.Token{}).Where("user_id = ?", userID).Update("revoked", true).Error
}

// PurgeExpired removes expired tokens.
func (r *TokenRepo) PurgeExpired() error {
	return r.db.Where("expires_at < ?", gorm.Expr("datetime('now')")).Delete(&models.Token{}).Error
}

// List returns all tokens (paginated).
func (r *TokenRepo) List(offset, limit int) ([]models.Token, error) {
	var tokens []models.Token
	if err := r.db.Offset(offset).Limit(limit).Find(&tokens).Error; err != nil {
		return nil, err
	}
	return tokens, nil
}

// Count returns the total number of tokens.
func (r *TokenRepo) Count() (int64, error) {
	var count int64
	if err := r.db.Model(&models.Token{}).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// FindByID retrieves a token by ID.
func (r *TokenRepo) FindByID(id uuid.UUID) (*models.Token, error) {
	var token models.Token
	if err := r.db.First(&token, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &token, nil
}

// HardDelete permanently deletes a token record.
func (r *TokenRepo) HardDelete(id uuid.UUID) error {
	return r.db.Unscoped().Delete(&models.Token{}, "id = ?", id).Error
}
