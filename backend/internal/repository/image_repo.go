package repository

import (
	"hill-images/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ImageRepo provides database access for Image entities.
type ImageRepo struct {
	db *gorm.DB
}

// NewImageRepo creates a new ImageRepo.
func NewImageRepo(db *gorm.DB) *ImageRepo {
	return &ImageRepo{db: db}
}

// Create inserts a new image record.
func (r *ImageRepo) Create(image *models.Image) error {
	return r.db.Create(image).Error
}

// FindByID retrieves an image by ID.
func (r *ImageRepo) FindByID(id uuid.UUID) (*models.Image, error) {
	var image models.Image
	if err := r.db.First(&image, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &image, nil
}

// FindByHash retrieves an image by its content hash.
func (r *ImageRepo) FindByHash(hash string) (*models.Image, error) {
	var image models.Image
	if err := r.db.First(&image, "hash = ?", hash).Error; err != nil {
		return nil, err
	}
	return &image, nil
}

// FindActiveByHash retrieves any active image with the given content hash
// (any owner). Used only for storage blob reuse, not ownership checks.
func (r *ImageRepo) FindActiveByHash(hash string) (*models.Image, error) {
	var image models.Image
	if err := r.db.Where("hash = ? AND deleted_at IS NULL", hash).First(&image).Error; err != nil {
		return nil, err
	}
	return &image, nil
}

// FindActiveByUserAndHash retrieves an active image owned by userID with hash.
func (r *ImageRepo) FindActiveByUserAndHash(userID uuid.UUID, hash string) (*models.Image, error) {
	var image models.Image
	if err := r.db.Where("user_id = ? AND hash = ? AND deleted_at IS NULL", userID, hash).First(&image).Error; err != nil {
		return nil, err
	}
	return &image, nil
}

// HardDeleteByUserAndHash permanently removes a soft-deleted row for this user
// so the composite unique (user_id, hash) is freed for re-upload.
func (r *ImageRepo) HardDeleteByUserAndHash(userID uuid.UUID, hash string) error {
	return r.db.Unscoped().Where("user_id = ? AND hash = ? AND deleted_at IS NOT NULL", userID, hash).Delete(&models.Image{}).Error
}

// HardDeleteByHash permanently removes soft-deleted rows for a hash (any user).
// Kept for admin cleanup paths.
func (r *ImageRepo) HardDeleteByHash(hash string) error {
	return r.db.Unscoped().Where("hash = ? AND deleted_at IS NOT NULL", hash).Delete(&models.Image{}).Error
}

// CountActiveByHash returns how many non-deleted ownership rows share a hash.
func (r *ImageRepo) CountActiveByHash(hash string) (int64, error) {
	var count int64
	err := r.db.Model(&models.Image{}).Where("hash = ? AND deleted_at IS NULL", hash).Count(&count).Error
	return count, err
}

// FindLocalCandidatesByYearAndHashPrefix retrieves local-storage images whose
// stored path belongs to a specific leading year segment and whose SHA-256 hash
// starts with the provided 12-char prefix. Callers finish disambiguation in Go
// using the pretty public filename (random8_hash12.ext).
func (r *ImageRepo) FindLocalCandidatesByYearAndHashPrefix(year, hashPrefix string) ([]models.Image, error) {
	var images []models.Image
	if err := r.db.Where(
		"storage_driver = ? AND path LIKE ? AND hash LIKE ?",
		"local",
		year+"/%",
		hashPrefix+"%",
	).Find(&images).Error; err != nil {
		return nil, err
	}
	return images, nil
}

// FindByUserID retrieves images for a user (paginated).
func (r *ImageRepo) FindByUserID(userID uuid.UUID, offset, limit int) ([]models.Image, error) {
	var images []models.Image
	if err := r.db.Where("user_id = ?", userID).Offset(offset).Limit(limit).Order("created_at DESC").Find(&images).Error; err != nil {
		return nil, err
	}
	return images, nil
}

// SearchByUserID searches images by filename for a user (paginated).
func (r *ImageRepo) SearchByUserID(userID uuid.UUID, query string, offset, limit int) ([]models.Image, error) {
	var images []models.Image
	like := "%" + query + "%"
	if err := r.db.Where("user_id = ? AND original_name LIKE ?", userID, like).
		Offset(offset).Limit(limit).Order("created_at DESC").Find(&images).Error; err != nil {
		return nil, err
	}
	return images, nil
}

// SearchAll searches images by filename across all users (paginated).
func (r *ImageRepo) SearchAll(query string, offset, limit int) ([]models.Image, error) {
	var images []models.Image
	like := "%" + query + "%"
	if err := r.db.Where("original_name LIKE ?", like).
		Offset(offset).Limit(limit).Order("created_at DESC").Find(&images).Error; err != nil {
		return nil, err
	}
	return images, nil
}

// ListAllSorted lists all images with sort and pagination.
func (r *ImageRepo) ListAllSorted(sort string, offset, limit int) ([]models.Image, error) {
	var images []models.Image
	order := sortOrder(sort)
	if err := r.db.Offset(offset).Limit(limit).Order(order).Find(&images).Error; err != nil {
		return nil, err
	}
	return images, nil
}

// ListByUserSorted lists images for a user with sort and pagination.
func (r *ImageRepo) ListByUserSorted(userID uuid.UUID, sort string, offset, limit int) ([]models.Image, error) {
	var images []models.Image
	order := sortOrder(sort)
	if err := r.db.Where("user_id = ?", userID).Offset(offset).Limit(limit).Order(order).Find(&images).Error; err != nil {
		return nil, err
	}
	return images, nil
}

// Update saves changes to an existing image.
func (r *ImageRepo) Update(image *models.Image) error {
	return r.db.Save(image).Error
}

// Delete soft-deletes an image.
func (r *ImageRepo) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Image{}, "id = ?", id).Error
}

// DeleteByUserID soft-deletes all images belonging to a user.
func (r *ImageRepo) DeleteByUserID(userID uuid.UUID) error {
	return r.db.Where("user_id = ?", userID).Delete(&models.Image{}).Error
}

// DeleteByHash soft-deletes an image by hash.
func (r *ImageRepo) DeleteByHash(hash string) error {
	return r.db.Where("hash = ?", hash).Delete(&models.Image{}).Error
}

// DeleteByHashesAndUser soft-deletes images by hashes owned by a specific user.
func (r *ImageRepo) DeleteByHashesAndUser(hashes []string, userID uuid.UUID) (int64, error) {
	result := r.db.Where("hash IN ? AND user_id = ?", hashes, userID).Delete(&models.Image{})
	return result.RowsAffected, result.Error
}

// DeleteByHashes soft-deletes images by hashes (admin: any owner).
func (r *ImageRepo) DeleteByHashes(hashes []string) (int64, error) {
	result := r.db.Where("hash IN ?", hashes).Delete(&models.Image{})
	return result.RowsAffected, result.Error
}

// CountByUserID returns total image count for a user.
func (r *ImageRepo) CountByUserID(userID uuid.UUID) (int64, error) {
	var count int64
	if err := r.db.Model(&models.Image{}).Where("user_id = ?", userID).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// CountAll returns total image count.
func (r *ImageRepo) CountAll() (int64, error) {
	var count int64
	if err := r.db.Model(&models.Image{}).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// CountSearchByUserID returns count of search results for a user.
func (r *ImageRepo) CountSearchByUserID(userID uuid.UUID, query string) (int64, error) {
	var count int64
	like := "%" + query + "%"
	if err := r.db.Model(&models.Image{}).Where("user_id = ? AND original_name LIKE ?", userID, like).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// CountSearchAll returns count of search results across all users.
func (r *ImageRepo) CountSearchAll(query string) (int64, error) {
	var count int64
	like := "%" + query + "%"
	if err := r.db.Model(&models.Image{}).Where("original_name LIKE ?", like).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// TotalSize returns the sum of all image sizes.
func (r *ImageRepo) TotalSize() (int64, error) {
	var total int64
	if err := r.db.Model(&models.Image{}).Select("COALESCE(SUM(size), 0)").Scan(&total).Error; err != nil {
		return 0, err
	}
	return total, nil
}

// sortOrder maps sort param to SQL ORDER BY clause.
func sortOrder(sort string) string {
	switch sort {
	case "size":
		return "size DESC"
	case "name":
		return "original_name ASC"
	default: // "date"
		return "created_at DESC"
	}
}

// FindLocalCandidatesByHashPrefix retrieves local-storage images whose SHA-256
// hash starts with the provided prefix. Used for API-key uploads that lack a
// year segment in their storage path.
func (r *ImageRepo) FindLocalCandidatesByHashPrefix(hashPrefix string) ([]models.Image, error) {
	var images []models.Image
	if err := r.db.Where(
		"storage_driver = ? AND hash LIKE ?",
		"local",
		hashPrefix+"%",
	).Find(&images).Error; err != nil {
		return nil, err
	}
	return images, nil
}
