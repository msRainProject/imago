package service

import (
	"hill-images/internal/models"
	"hill-images/internal/repository"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ImageService handles image business logic.
type ImageService struct {
	imageRepo *repository.ImageRepo
}

// NewImageService creates a new ImageService.
func NewImageService(imageRepo *repository.ImageRepo) *ImageService {
	return &ImageService{imageRepo: imageRepo}
}

// GetByID retrieves an image by its ID.
func (s *ImageService) GetByID(id uuid.UUID) (*models.Image, error) {
	return s.imageRepo.FindByID(id)
}

// GetByHash retrieves an image by its content hash.
func (s *ImageService) GetByHash(hash string) (*models.Image, error) {
	return s.imageRepo.FindByHash(hash)
}

func (s *ImageService) FindLocalByPublicPath(year, prettyName string) (*models.Image, error) {
	// New format: rand8 + hash12 (no underscore) = 20 chars.
	if len(prettyName) != 20 {
		return nil, gorm.ErrRecordNotFound
	}
	hashPrefix := prettyName[8:]
	candidates, err := s.imageRepo.FindLocalCandidatesByYearAndHashPrefix(year, hashPrefix)
	if err != nil {
		return nil, err
	}
	for i := range candidates {
		if localPrettyNameFromImage(&candidates[i]) == prettyName {
			return &candidates[i], nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

// ListParams holds parameters for listing images.
type ListParams struct {
	UserID   uuid.UUID
	IsAdmin  bool
	Page     int
	PageSize int
	Search   string
	Sort     string
}

// ListResult holds paginated image list results.
type ListResult struct {
	Data     []models.Image `json:"data"`
	Total    int64          `json:"total"`
	Page     int            `json:"page"`
	PageSize int            `json:"pageSize"`
}

// List retrieves images with filtering, sorting, and pagination.
func (s *ImageService) List(params ListParams) (*ListResult, error) {
	offset := (params.Page - 1) * params.PageSize
	var images []models.Image
	var total int64
	var err error

	if params.IsAdmin {
		if params.Search != "" {
			total, err = s.imageRepo.CountSearchAll(params.Search)
			if err != nil {
				return nil, err
			}
			images, err = s.imageRepo.SearchAll(params.Search, offset, params.PageSize)
		} else {
			total, err = s.imageRepo.CountAll()
			if err != nil {
				return nil, err
			}
			images, err = s.imageRepo.ListAllSorted(params.Sort, offset, params.PageSize)
		}
	} else {
		if params.Search != "" {
			total, err = s.imageRepo.CountSearchByUserID(params.UserID, params.Search)
			if err != nil {
				return nil, err
			}
			images, err = s.imageRepo.SearchByUserID(params.UserID, params.Search, offset, params.PageSize)
		} else {
			total, err = s.imageRepo.CountByUserID(params.UserID)
			if err != nil {
				return nil, err
			}
			images, err = s.imageRepo.ListByUserSorted(params.UserID, params.Sort, offset, params.PageSize)
		}
	}

	if err != nil {
		return nil, err
	}

	return &ListResult{
		Data:     images,
		Total:    total,
		Page:     params.Page,
		PageSize: params.PageSize,
	}, nil
}

// Create persists a new image record.
func (s *ImageService) Create(image *models.Image) error {
	return s.imageRepo.Create(image)
}

// Delete soft-deletes an image by ID.
func (s *ImageService) Delete(id uuid.UUID) error {
	return s.imageRepo.Delete(id)
}

// DeleteByHash soft-deletes an image by hash.
func (s *ImageService) DeleteByHash(hash string) error {
	return s.imageRepo.DeleteByHash(hash)
}

// BatchDelete deletes images by hashes for a user (or all if admin).
func (s *ImageService) BatchDelete(hashes []string, userID uuid.UUID, isAdmin bool) (int64, error) {
	if isAdmin {
		return s.imageRepo.DeleteByHashes(hashes)
	}
	return s.imageRepo.DeleteByHashesAndUser(hashes, userID)
}

// Rename updates both the display name (Filename) and the user-friendly
// original name (OriginalName) of an image identified by hash so that the
// file manager immediately reflects the new name.
func (s *ImageService) Rename(hash string, newName string) (*models.Image, error) {
	img, err := s.imageRepo.FindByHash(hash)
	if err != nil {
		return nil, err
	}
	img.OriginalName = newName
	img.Filename = newName
	if err := s.imageRepo.Update(img); err != nil {
		return nil, err
	}
	return img, nil
}

// StatsResult holds public statistics.
type StatsResult struct {
	TotalImages int64 `json:"total_images"`
	TotalSize   int64 `json:"total_size"`
	TotalUsers  int64 `json:"total_users"`
}

// Stats returns public statistics. Requires userRepo for user count.
type StatsService struct {
	imageRepo *repository.ImageRepo
	userRepo  *repository.UserRepo
}

// NewStatsService creates a new StatsService.
func NewStatsService(imageRepo *repository.ImageRepo, userRepo *repository.UserRepo) *StatsService {
	return &StatsService{imageRepo: imageRepo, userRepo: userRepo}
}

// Get returns aggregate statistics.
func (s *StatsService) Get() (*StatsResult, error) {
	totalImages, err := s.imageRepo.CountAll()
	if err != nil {
		return nil, err
	}
	totalSize, err := s.imageRepo.TotalSize()
	if err != nil {
		return nil, err
	}
	totalUsers, err := s.userRepo.Count()
	if err != nil {
		return nil, err
	}
	return &StatsResult{
		TotalImages: totalImages,
		TotalSize:   totalSize,
		TotalUsers:  totalUsers,
	}, nil
}

// HashExists checks if an active (non-soft-deleted) image with the given hash
// already exists. If a soft-deleted record is found, it is hard-deleted so the
// unique constraint is freed for re-upload.
func (s *ImageService) HashExists(hash string) (*models.Image, bool) {
	img, err := s.imageRepo.FindActiveByHash(hash)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			_ = s.imageRepo.HardDeleteByHash(hash)
			return nil, false
		}
		return nil, false
	}
	return img, true
}

func (s *ImageService) UpdateThumbPath(img *models.Image) error {
	return s.imageRepo.Update(img)
}

func localPrettyNameFromImage(img *models.Image) string {
	name := img.Filename
	if name == "" {
		name = filepath.Base(img.Path)
	}
	ext := filepath.Ext(name)
	base := strings.TrimSuffix(name, ext)
	short := base
	if len(base) >= 8 {
		short = base[:8]
	}
	return short + img.Hash[:12]
}

// FindLocalByPrettyName looks up a local image by its pretty name (rand8+hash12)
// without requiring a year segment. Used for API-key uploads.
func (s *ImageService) FindLocalByPrettyName(prettyName string) (*models.Image, error) {
	if len(prettyName) < 12 {
		return nil, gorm.ErrRecordNotFound
	}
	hashPrefix := prettyName[8:]
	if len(hashPrefix) > 12 {
		hashPrefix = hashPrefix[:12]
	}
	candidates, err := s.imageRepo.FindLocalCandidatesByHashPrefix(hashPrefix)
	if err != nil {
		return nil, err
	}
	for i := range candidates {
		if localPrettyNameFromImage(&candidates[i]) == prettyName {
			return &candidates[i], nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}
