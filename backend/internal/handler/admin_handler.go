package handler

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"

	"hill-images/internal/models"
	"hill-images/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// AdminHandler handles admin endpoints.
type AdminHandler struct {
	userRepo     *repository.UserRepo
	imageRepo    *repository.ImageRepo
	apiTokenRepo *repository.APITokenRepo
	apiKeyRepo   *repository.APIKeyRepo
	configRepo   *repository.ConfigRepo
}

// NewAdminHandler creates a new AdminHandler with all required repos.
func NewAdminHandler(userRepo *repository.UserRepo, imageRepo *repository.ImageRepo, apiTokenRepo *repository.APITokenRepo, apiKeyRepo *repository.APIKeyRepo, configRepo *repository.ConfigRepo) *AdminHandler {
	return &AdminHandler{
		userRepo:     userRepo,
		imageRepo:    imageRepo,
		apiTokenRepo: apiTokenRepo,
		apiKeyRepo:   apiKeyRepo,
		configRepo:   configRepo,
	}
}

// --- User management ---

// ListUsers handles GET /api/admin/users.
func (h *AdminHandler) ListUsers(c *gin.Context) {
	users, err := h.userRepo.List(0, 1000)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": http.StatusInternalServerError, "error": "LIST_FAILED", "message": "failed to list users"})
		return
	}
	total, _ := h.userRepo.Count()
	c.JSON(http.StatusOK, gin.H{"code": 200, "data": gin.H{"data": users, "total": total}})
}

type createUserRequest struct {
	Username    string  `json:"username" binding:"required"`
	Password    string  `json:"password" binding:"required,min=6"`
	Role        string  `json:"role" binding:"required,oneof=admin user"`
	DisplayName *string `json:"display_name"`
}

// CreateUser handles POST /api/admin/users.
func (h *AdminHandler) CreateUser(c *gin.Context) {
	var req createUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "ERR_VALIDATION"})
		return
	}

	existing, _ := h.userRepo.FindByUsername(req.Username)
	if existing != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "username already exists", "code": "ERR_DUPLICATE"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	user := &models.User{
		Username:     req.Username,
		PasswordHash: string(hash),
		Role:         req.Role,
	}
	if req.DisplayName != nil {
		user.DisplayName = *req.DisplayName
	}
	if err := h.userRepo.Create(user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": user})
}

type updateUserRequest struct {
	Username    *string `json:"username"`
	Password    *string `json:"password"`
	Role        *string `json:"role"`
	DisplayName *string `json:"display_name"`
}

// UpdateUser handles PATCH /api/admin/users/:id.
func (h *AdminHandler) UpdateUser(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id", "code": "ERR_VALIDATION"})
		return
	}

	user, err := h.userRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found", "code": "ERR_NOT_FOUND"})
		return
	}

	var req updateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "ERR_VALIDATION"})
		return
	}

	if req.Username != nil {
		existing, _ := h.userRepo.FindByUsername(*req.Username)
		if existing != nil && existing.ID != user.ID {
			c.JSON(http.StatusConflict, gin.H{"error": "username already exists", "code": "ERR_DUPLICATE"})
			return
		}
		user.Username = *req.Username
	}
	if req.Password != nil {
		hash, err := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
			return
		}
		user.PasswordHash = string(hash)
	}
	if req.Role != nil {
		if *req.Role != "admin" && *req.Role != "user" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "role must be admin or user", "code": "ERR_VALIDATION"})
			return
		}
		user.Role = *req.Role
	}
	if req.DisplayName != nil {
		user.DisplayName = *req.DisplayName
	}

	if err := h.userRepo.Update(user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": user})
}

// DeleteUser handles DELETE /api/admin/users/:id.
func (h *AdminHandler) DeleteUser(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id", "code": "ERR_VALIDATION"})
		return
	}

	callerID, _ := c.Get("user_id")
	if callerID == id {
		c.JSON(http.StatusForbidden, gin.H{"error": "cannot delete self", "code": "ERR_FORBIDDEN"})
		return
	}

	_, err = h.userRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found", "code": "ERR_NOT_FOUND"})
		return
	}

	_ = h.imageRepo.DeleteByUserID(id)
	_ = h.userRepo.Delete(id)

	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

// --- API Token management ---

// ListTokens handles GET /api/admin/tokens.
func (h *AdminHandler) ListTokens(c *gin.Context) {
	tokens, err := h.apiTokenRepo.List(0, 1000)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list tokens"})
		return
	}
	total, _ := h.apiTokenRepo.Count()
	c.JSON(http.StatusOK, gin.H{"data": tokens, "total": total})
}

type createTokenRequest struct {
	Name string `json:"name" binding:"required"`
}

// CreateToken handles POST /api/admin/tokens.
func (h *AdminHandler) CreateToken(c *gin.Context) {
	var req createTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "ERR_VALIDATION"})
		return
	}

	rawToken, err := generateRandomToken(32)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	hash := sha256.Sum256([]byte(rawToken))
	tokenHash := hex.EncodeToString(hash[:])

	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "code": "ERR_UNAUTHORIZED"})
		return
	}

	token := &models.APIToken{
		UserID:    userID,
		Name:      req.Name,
		TokenHash: tokenHash,
	}
	if err := h.apiTokenRepo.Create(token); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create token"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"token": rawToken,
		"name":  token.Name,
		"id":    token.ID,
	})
}

// DeleteToken handles DELETE /api/admin/tokens/:id.
func (h *AdminHandler) DeleteToken(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid token id", "code": "ERR_VALIDATION"})
		return
	}

	_, err = h.apiTokenRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "token not found", "code": "ERR_NOT_FOUND"})
		return
	}

	_ = h.apiTokenRepo.Delete(id)
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

// --- API Key (App Token) management ---

// ListAPIKeys handles GET /api/admin/api-keys.
func (h *AdminHandler) ListAPIKeys(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "code": "ERR_UNAUTHORIZED"})
		return
	}

	keys, err := h.apiKeyRepo.ListByUserID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list api keys"})
		return
	}

	type apiKeyResponse struct {
		ID               uuid.UUID  `json:"id"`
		Name             string     `json:"name"`
		IsActive         bool       `json:"is_active"`
		UploadCount      int64      `json:"upload_count"`
		UploadTotalBytes int64      `json:"upload_total_bytes"`
		LastUsed         *time.Time `json:"last_used"`
		CreatedAt        time.Time  `json:"created_at"`
	}

	result := make([]apiKeyResponse, len(keys))
	for i, k := range keys {
		result[i] = apiKeyResponse{
			ID:               k.ID,
			Name:             k.Name,
			IsActive:         k.IsActive,
			UploadCount:      k.UploadCount,
			UploadTotalBytes: k.UploadTotalBytes,
			LastUsed:         k.LastUsed,
			CreatedAt:        k.CreatedAt,
		}
	}

	c.JSON(http.StatusOK, gin.H{"code": 200, "data": result})
}

type createAPIKeyRequest struct {
	Name string `json:"name" binding:"required"`
}

// CreateAPIKey handles POST /api/admin/api-keys.
func (h *AdminHandler) CreateAPIKey(c *gin.Context) {
	var req createAPIKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "ERR_VALIDATION"})
		return
	}

	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}
	rawToken := "app_" + hex.EncodeToString(b)

	hash := sha256.Sum256([]byte(rawToken))
	tokenHash := hex.EncodeToString(hash[:])

	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "code": "ERR_UNAUTHORIZED"})
		return
	}

	key := &models.APIKey{
		Name:      req.Name,
		UserID:    userID,
		APIToken:  rawToken[:8] + "...",
		TokenHash: tokenHash,
		IsActive:  true,
	}
	if err := h.apiKeyRepo.Create(key); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create api key"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"code": 201,
		"data": gin.H{
			"id":        key.ID,
			"name":      key.Name,
			"api_token": rawToken,
		},
	})
}

// DeleteAPIKey handles DELETE /api/admin/api-keys/:id.
func (h *AdminHandler) DeleteAPIKey(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid api key id", "code": "ERR_VALIDATION"})
		return
	}

	_, err = h.apiKeyRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "api key not found", "code": "ERR_NOT_FOUND"})
		return
	}

	_ = h.apiKeyRepo.Delete(id)
	c.JSON(http.StatusOK, gin.H{"code": 200, "deleted": true})
}

// --- Config management ---

var sensitiveKeys = map[string]bool{
	"api_key":              true,
	"jwt.secret":           true,
	"upyun.password":       true,
	"r2.secret_access_key": true,
	"s3.secret_access_key": true,
}

var readOnlyKeys = map[string]bool{
	"jwt.secret":         true,
	"jwt.access_secret":  true,
	"jwt.refresh_secret": true,
}

// GetConfig handles GET /api/admin/config.
func (h *AdminHandler) GetConfig(c *gin.Context) {
	entries, err := h.configRepo.List()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load config"})
		return
	}

	data := make(map[string]string, len(entries))
	for _, entry := range entries {
		if sensitiveKeys[entry.Key] {
			data[entry.Key] = "***"
		} else {
			data[entry.Key] = entry.Value
		}
	}

	c.JSON(http.StatusOK, gin.H{"code": 200, "data": data})
}

// UpdateConfig handles PUT /api/admin/config.
func (h *AdminHandler) UpdateConfig(c *gin.Context) {
	var updates map[string]string
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "ERR_VALIDATION"})
		return
	}

	for key := range updates {
		if readOnlyKeys[key] {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("key %s is read-only", key), "code": "ERR_READ_ONLY"})
			return
		}
	}

	for key, value := range updates {
		existing, err := h.configRepo.FindByKey(key)
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				entry := &models.ConfigEntry{Key: key, Value: value}
				if err := h.configRepo.Upsert(entry); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to set config key: %s", key)})
					return
				}
				continue
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query config"})
			return
		}
		existing.Value = value
		if err := h.configRepo.Upsert(existing); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to update config key: %s", key)})
			return
		}
	}

	entries, _ := h.configRepo.List()
	data := make(map[string]string, len(entries))
	for _, entry := range entries {
		if sensitiveKeys[entry.Key] {
			data[entry.Key] = "***"
		} else {
			data[entry.Key] = entry.Value
		}
	}

	c.JSON(http.StatusOK, gin.H{"code": 200, "data": data})
}

// --- helpers ---

func generateRandomToken(byteLen int) (string, error) {
	b := make([]byte, byteLen)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return fmt.Sprintf("hill_%s", hex.EncodeToString(b)), nil
}

// isSensitiveKey checks if a config key contains sensitive patterns.
func isSensitiveKey(key string) bool {
	lower := strings.ToLower(key)
	for pattern := range sensitiveKeys {
		if strings.Contains(lower, pattern) {
			return true
		}
	}
	return false
}
