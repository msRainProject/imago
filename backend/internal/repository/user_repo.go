package repository

import (
	"hill-images/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// UserRepo provides database access for User entities.
type UserRepo struct {
	db *gorm.DB
}

// NewUserRepo creates a new UserRepo.
func NewUserRepo(db *gorm.DB) *UserRepo {
	return &UserRepo{db: db}
}

// Create inserts a new user.
func (r *UserRepo) Create(user *models.User) error {
	return r.db.Create(user).Error
}

// FindByID retrieves a user by ID.
func (r *UserRepo) FindByID(id uuid.UUID) (*models.User, error) {
	var user models.User
	if err := r.db.First(&user, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// FindByUsername retrieves a user by username.
func (r *UserRepo) FindByUsername(username string) (*models.User, error) {
	var user models.User
	if err := r.db.First(&user, "username = ?", username).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// Update saves changes to an existing user.
func (r *UserRepo) Update(user *models.User) error {
	return r.db.Save(user).Error
}

// Delete soft-deletes a user.
func (r *UserRepo) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.User{}, "id = ?", id).Error
}

// List returns users with pagination.
func (r *UserRepo) List(offset, limit int) ([]models.User, error) {
	var users []models.User
	if err := r.db.Offset(offset).Limit(limit).Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

// Count returns the total number of users.
func (r *UserRepo) Count() (int64, error) {
	var count int64
	if err := r.db.Model(&models.User{}).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// ListAll returns all users without pagination.
func (r *UserRepo) ListAll() ([]models.User, error) {
	var users []models.User
	if err := r.db.Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}
