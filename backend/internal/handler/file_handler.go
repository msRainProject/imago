package handler

import (
	"net/http"
	"strconv"
	"strings"

	"hill-images/internal/config"
	"hill-images/internal/repository"
	"hill-images/internal/service"
	"hill-images/internal/storage"

	"github.com/gin-gonic/gin"
)

func isAllowedUploadMIME(mime string) bool {
	mime = strings.ToLower(strings.TrimSpace(mime))
	return (strings.HasPrefix(mime, "image/") && mime != "image/svg+xml") || mime == "application/x-adobe-dng"
}

// maxUploadSize is 50 MB.
const maxUploadSize = 100 << 20

type FileHandler struct {
	imageService   *service.ImageService
	mediaProcessor *service.MediaProcessor
	statsService   *service.StatsService
	configRepo     *repository.ConfigRepo
	storage        storage.Storage
	cfg            *config.Config
	authService    *service.AuthService
	apiTokenRepo   *repository.APITokenRepo
	apiKeyRepo     *repository.APIKeyRepo
	userRepo       *repository.UserRepo
}

func NewFileHandler(
	imageService *service.ImageService,
	mediaProcessor *service.MediaProcessor,
	statsService *service.StatsService,
	configRepo *repository.ConfigRepo,
	store storage.Storage,
	cfg *config.Config,
	authService *service.AuthService,
	apiTokenRepo *repository.APITokenRepo,
	apiKeyRepo *repository.APIKeyRepo,
	userRepo *repository.UserRepo,
) *FileHandler {
	return &FileHandler{
		imageService:   imageService,
		mediaProcessor: mediaProcessor,
		statsService:   statsService,
		configRepo:     configRepo,
		storage:        store,
		cfg:            cfg,
		authService:    authService,
		apiTokenRepo:   apiTokenRepo,
		apiKeyRepo:     apiKeyRepo,
		userRepo:       userRepo,
	}
}

type uploadClientConfig struct {
	Enabled      bool    `json:"enabled"`
	TargetFormat string  `json:"target_format"`
	MaxSizeMB    float64 `json:"max_size_mb"`
	MaxWidth     int     `json:"max_width"`
	MaxHeight    int     `json:"max_height"`
	MaxUploadMB  int     `json:"max_upload_mb"`
	AllowedExt   string  `json:"allowed_ext"`
}

func parseConfigBool(value string, fallback bool) bool {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	switch trimmed {
	case "true", "1", "yes", "on":
		return true
	case "false", "0", "no", "off":
		return false
	default:
		return fallback
	}
}

func parseConfigFloat(value string, fallback float64) float64 {
	f, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
	if err != nil {
		return fallback
	}
	return f
}

func parseConfigInt(value string, fallback int) int {
	n, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		return fallback
	}
	return n
}

func normalizeTargetFormat(value string) string {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case "jpeg", "jpg":
		return "jpeg"
	case "png":
		return "png"
	case "webp":
		return "webp"
	default:
		return "original"
	}
}

func (h *FileHandler) readUploadClientConfig() uploadClientConfig {
	cfg := uploadClientConfig{
		Enabled:      false,
		TargetFormat: "original",
		MaxSizeMB:    1,
		MaxWidth:     2560,
		MaxHeight:    2560,
		MaxUploadMB:  maxUploadSize >> 20,
		AllowedExt:   "jpg,jpeg,png,gif,bmp,webp,ico,heic,heif",
	}

	if h.configRepo == nil {
		return cfg
	}

	entries, err := h.configRepo.List()
	if err != nil {
		return cfg
	}

	for _, entry := range entries {
		switch entry.Key {
		case "upload.process.enabled":
			cfg.Enabled = parseConfigBool(entry.Value, cfg.Enabled)
		case "upload.process.target_format":
			cfg.TargetFormat = normalizeTargetFormat(entry.Value)
		case "upload.process.max_size_mb":
			cfg.MaxSizeMB = parseConfigFloat(entry.Value, cfg.MaxSizeMB)
		case "upload.process.max_width":
			cfg.MaxWidth = parseConfigInt(entry.Value, cfg.MaxWidth)
		case "upload.process.max_height":
			cfg.MaxHeight = parseConfigInt(entry.Value, cfg.MaxHeight)
		case "maxSize":
			bytes := parseConfigInt(entry.Value, maxUploadSize)
			if bytes > 0 {
				cfg.MaxUploadMB = bytes / (1024 * 1024)
			}
		case "allowedExt":
			if trimmed := strings.TrimSpace(entry.Value); trimmed != "" {
				cfg.AllowedExt = trimmed
			}
		}
	}

	if cfg.MaxSizeMB < 0.01 {
		cfg.MaxSizeMB = 0.01
	}
	if cfg.MaxWidth < 0 {
		cfg.MaxWidth = 0
	}
	if cfg.MaxHeight < 0 {
		cfg.MaxHeight = 0
	}
	if cfg.MaxUploadMB < 1 {
		cfg.MaxUploadMB = maxUploadSize >> 20
	}

	return cfg
}

// ---- handlers ----

// List handles GET /api/files — paginated file list.
func (h *FileHandler) List(c *gin.Context) {
	userID, exists := getUserID(c)
	if !exists {
		fileError(c, http.StatusUnauthorized, "unauthorized", "AUTH_FAILED")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	search := c.Query("search")
	sort := c.DefaultQuery("sort", "date")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	result, err := h.imageService.List(service.ListParams{
		UserID:   userID,
		IsAdmin:  isAdmin(c),
		Page:     page,
		PageSize: pageSize,
		Search:   search,
		Sort:     sort,
	})
	if err != nil {
		fileError(c, http.StatusInternalServerError, "failed to list images", "LIST_FAILED")
		return
	}

	items := make([]imageResponse, 0, len(result.Data))
	for _, img := range result.Data {
		items = append(items, toImageResponse(img, storageResponseURL(h.storage, img.Path, img.Hash)))
	}

	fileSuccess(c, gin.H{
		"data":     items,
		"total":    result.Total,
		"page":     result.Page,
		"pageSize": result.PageSize,
	})
}

// Get handles GET /api/files/:hash — single image metadata.
func (h *FileHandler) Get(c *gin.Context) {
	hash := c.Param("hash")
	if hash == "" {
		fileError(c, http.StatusBadRequest, "missing hash", "VALIDATION_ERROR")
		return
	}

	img, err := h.imageService.GetByHash(hash)
	if err != nil {
		fileError(c, http.StatusNotFound, "image not found", "NOT_FOUND")
		return
	}

	fileSuccess(c, toImageResponse(*img, storageResponseURL(h.storage, img.Path, img.Hash)))
}

// Delete handles DELETE /api/files/:hash — delete single image.
func (h *FileHandler) Delete(c *gin.Context) {
	userID, exists := getUserID(c)
	if !exists {
		fileError(c, http.StatusUnauthorized, "unauthorized", "AUTH_FAILED")
		return
	}

	hash := c.Param("hash")
	if hash == "" {
		fileError(c, http.StatusBadRequest, "missing hash", "VALIDATION_ERROR")
		return
	}

	img, err := h.imageService.GetByHash(hash)
	if err != nil {
		fileError(c, http.StatusNotFound, "image not found", "NOT_FOUND")
		return
	}

	if img.UserID != userID && !isAdmin(c) {
		fileError(c, http.StatusForbidden, "forbidden", "FORBIDDEN")
		return
	}

	_ = h.storage.Delete(c.Request.Context(), img.Path)
	if img.ThumbPath != "" {
		_ = h.storage.DeleteThumb(c.Request.Context(), img.ThumbPath)
	}

	if err := h.imageService.DeleteByHash(hash); err != nil {
		fileError(c, http.StatusInternalServerError, "failed to delete image", "DELETE_FAILED")
		return
	}

	fileSuccess(c, gin.H{"deleted": true})
}

// BatchDelete handles POST /api/files/batch_delete.
func (h *FileHandler) BatchDelete(c *gin.Context) {
	userID, exists := getUserID(c)
	if !exists {
		fileError(c, http.StatusUnauthorized, "unauthorized", "AUTH_FAILED")
		return
	}

	var body struct {
		Hashes []string `json:"hashes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		fileError(c, http.StatusBadRequest, "invalid request body", "VALIDATION_ERROR")
		return
	}

	if len(body.Hashes) == 0 {
		fileError(c, http.StatusBadRequest, "no hashes provided", "VALIDATION_ERROR")
		return
	}

	ctx := c.Request.Context()
	for _, hash := range body.Hashes {
		img, err := h.imageService.GetByHash(hash)
		if err != nil {
			continue
		}
		if img.UserID != userID && !isAdmin(c) {
			continue
		}
		_ = h.storage.Delete(ctx, img.Path)
		if img.ThumbPath != "" {
			_ = h.storage.DeleteThumb(ctx, img.ThumbPath)
		}
	}

	deleted, err := h.imageService.BatchDelete(body.Hashes, userID, isAdmin(c))
	if err != nil {
		fileError(c, http.StatusInternalServerError, "failed to delete images", "BATCH_DELETE_FAILED")
		return
	}

	fileSuccess(c, gin.H{"deleted": deleted})
}

// Rename handles PATCH /api/files/:hash — rename image.
func (h *FileHandler) Rename(c *gin.Context) {
	userID, exists := getUserID(c)
	if !exists {
		fileError(c, http.StatusUnauthorized, "unauthorized", "AUTH_FAILED")
		return
	}

	hash := c.Param("hash")
	if hash == "" {
		fileError(c, http.StatusBadRequest, "missing hash", "VALIDATION_ERROR")
		return
	}

	var body struct {
		Name string `json:"name"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		fileError(c, http.StatusBadRequest, "invalid request body", "VALIDATION_ERROR")
		return
	}

	if body.Name == "" {
		fileError(c, http.StatusBadRequest, "name is required", "VALIDATION_ERROR")
		return
	}

	img, err := h.imageService.GetByHash(hash)
	if err != nil {
		fileError(c, http.StatusNotFound, "image not found", "NOT_FOUND")
		return
	}

	if img.UserID != userID && !isAdmin(c) {
		fileError(c, http.StatusForbidden, "forbidden", "FORBIDDEN")
		return
	}

	updated, err := h.imageService.Rename(hash, body.Name)
	if err != nil {
		fileError(c, http.StatusInternalServerError, "failed to rename", "RENAME_FAILED")
		return
	}

	fileSuccess(c, toImageResponse(*updated, storageResponseURL(h.storage, updated.Path, updated.Hash)))
}

// Stats handles GET /api/stats — public statistics.
func (h *FileHandler) Stats(c *gin.Context) {
	stats, err := h.statsService.Get()
	if err != nil {
		fileError(c, http.StatusInternalServerError, "failed to get stats", "STATS_FAILED")
		return
	}
	fileSuccess(c, stats)
}

// UploadOptions handles GET /api/upload/options — public client-side upload settings.
func (h *FileHandler) UploadOptions(c *gin.Context) {
	fileSuccess(c, h.readUploadClientConfig())
}
