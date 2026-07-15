package handler

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"image"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"hill-images/internal/models"
	"hill-images/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// getUserID extracts user_id from context (set by JWT middleware).
func getUserID(c *gin.Context) (uuid.UUID, bool) {
	raw, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, false
	}
	id, ok := raw.(uuid.UUID)
	return id, ok
}

// getRole extracts role from context.
func getRole(c *gin.Context) string {
	raw, _ := c.Get("role")
	role, _ := raw.(string)
	return role
}

// isAdmin checks if the current user is admin.
func isAdmin(c *gin.Context) bool {
	return getRole(c) == "admin"
}

// fileSuccess wraps data in the standard {code:200, data:...} envelope
// expected by the frontend apiGet/apiDelete/apiPatch/apiPost helpers.
func fileSuccess(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, gin.H{"code": 200, "data": data})
}

// fileCreated wraps data in the standard {code:201, data:...} envelope.
func fileCreated(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, gin.H{"code": 201, "data": data})
}

// fileError returns a standard error envelope: {code:N, error:"ERR_CODE", message:"..."}.
func fileError(c *gin.Context, status int, msg string, errCode string) {
	c.JSON(status, gin.H{"code": status, "error": errCode, "message": msg})
}

func (h *FileHandler) OptionalAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := ""
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
				tokenStr = parts[1]
			}
		}
		if tokenStr == "" {
			if cookie, err := c.Cookie("hill_session"); err == nil {
				tokenStr = cookie
			}
		}
		if tokenStr == "" {
			c.Next()
			return
		}
		claims, err := h.authService.ParseToken(tokenStr)
		if err != nil {
			c.Next()
			return
		}
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("role", claims.Role)
		c.Next()
	}
}

// apiTokenAuth checks X-API-Token header as alternative auth for upload.
func (h *FileHandler) apiTokenAuth(c *gin.Context) (uuid.UUID, bool) {
	tokenHeader := c.GetHeader("X-API-Token")
	if tokenHeader == "" {
		return uuid.Nil, false
	}
	hash := sha256.Sum256([]byte(tokenHeader))
	tokenHash := hex.EncodeToString(hash[:])

	tokenRecord, err := h.apiTokenRepo.FindByTokenHash(tokenHash)
	if err != nil {
		return uuid.Nil, false
	}
	user, err := h.userRepo.FindByID(tokenRecord.UserID)
	if err != nil {
		return uuid.Nil, false
	}
	_ = h.apiTokenRepo.UpdateLastUsed(tokenRecord.ID)
	return user.ID, true
}

// imageResponse shapes the JSON output for a single image.
type imageResponse struct {
	ID           string `json:"id"`
	Hash         string `json:"hash"`
	Name         string `json:"name"`
	OriginalName string `json:"original_name"`
	MimeType     string `json:"mime_type"`
	URL          string `json:"url"`
	ThumbURL     string `json:"thumb_url"`
	Size         int64  `json:"size"`
	Width        int    `json:"width"`
	Height       int    `json:"height"`
	UploadedAt   string `json:"uploaded_at"`
}

func toImageResponse(img models.Image, publicURL, thumbURL string) imageResponse {
	return imageResponse{
		ID:           img.ID.String(),
		Hash:         img.Hash,
		Name:         img.Filename,
		OriginalName: img.OriginalName,
		MimeType:     img.MimeType,
		URL:          publicURL,
		ThumbURL:     thumbURL,
		Size:         img.Size,
		Width:        img.Width,
		Height:       img.Height,
		UploadedAt:   img.CreatedAt.Format(time.RFC3339),
	}
}

func storageResponseURL(s storage.Storage, key, hash string) string {
	if local, ok := s.(*storage.LocalStorage); ok {
		return local.PrettyPublicURL(key, hash)
	}
	return s.PublicURL(key)
}

func thumbResponseURL(hash string) string {
	return "/api/files/" + hash + "/thumb"
}

// extractDimensions reads image dimensions from file data.
func extractDimensions(data []byte, _ string) (width, height int) {
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return 0, 0
	}
	return cfg.Width, cfg.Height
}

// extensionFromMIME returns a file extension for a MIME type.
func extensionFromMIME(mime string) string {
	switch mime {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/gif":
		return ".gif"
	case "image/webp":
		return ".webp"
	case "image/svg+xml":
		return ".svg"
	case "image/heic", "image/heif":
		return ".heic"
	case "image/x-adobe-dng", "image/dng", "application/x-adobe-dng":
		return ".dng"
	default:
		return ".bin"
	}
}

func mimeFromFilename(filename string) string {
	switch strings.ToLower(filepath.Ext(filename)) {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".svg":
		return "image/svg+xml"
	case ".heic":
		return "image/heic"
	case ".heif":
		return "image/heif"
	case ".dng":
		return "image/x-adobe-dng"
	default:
		return "application/octet-stream"
	}
}

// PHP-compatible file manager stubs (not yet implemented).
func (h *FileHandler) PHPList(c *gin.Context) {
	fileError(c, http.StatusNotImplemented, "PHP endpoint not yet implemented", "NOT_IMPLEMENTED")
}

func (h *FileHandler) PHPFileManagerAction(c *gin.Context) {
	fileError(c, http.StatusNotImplemented, "PHP endpoint not yet implemented", "NOT_IMPLEMENTED")
}
