package handler

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"hill-images/internal/models"
	"hill-images/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (h *FileHandler) ServeLocalPretty(c *gin.Context) {
	if h.storage.Driver() != storage.DriverLocal {
		fileError(c, http.StatusNotFound, "image not found", "NOT_FOUND")
		return
	}

	fullPath := c.Request.URL.Path
	fullPath = strings.TrimPrefix(fullPath, "/")
	if fullPath == "" {
		fileError(c, http.StatusBadRequest, "invalid local image path", "VALIDATION_ERROR")
		return
	}

	parts := strings.SplitN(fullPath, "/", 2)
	if isYearSegment(parts[0]) && len(parts) == 2 {
		year := parts[0]
		name := filepath.Base(parts[1])
		if name == "" || name == "." {
			fileError(c, http.StatusBadRequest, "invalid local image path", "VALIDATION_ERROR")
			return
		}
		img, err := h.imageService.FindLocalByPublicPath(year, name)
		if err != nil {
			fileError(c, http.StatusNotFound, "image not found", "NOT_FOUND")
			return
		}
		h.serveImage(c, img)
		return
	}

	prettyName := filepath.Base(fullPath)
	img, err := h.imageService.FindLocalByPrettyName(prettyName)
	if err != nil {
		fileError(c, http.StatusNotFound, "image not found", "NOT_FOUND")
		return
	}
	h.serveImage(c, img)
}

func isYearSegment(s string) bool {
	if len(s) != 4 {
		return false
	}
	for _, ch := range s {
		if ch < '0' || ch > '9' {
			return false
		}
	}
	return true
}

func (h *FileHandler) serveImage(c *gin.Context, img *models.Image) {
	stream, err := h.storage.Open(c.Request.Context(), img.Path)
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			fileError(c, http.StatusNotFound, "file not found", "NOT_FOUND")
			return
		}
		fileError(c, http.StatusInternalServerError, "failed to open file", "OPEN_FAILED")
		return
	}
	defer stream.Close()
	c.Header("Content-Type", img.MimeType)
	c.Header("Cache-Control", "public, max-age=31536000")
	c.Status(http.StatusOK)
	_, _ = io.Copy(c.Writer, stream)
}

const thumbCacheControl = "public, max-age=31536000, immutable"

// ServeThumb handles GET /api/files/:hash/thumb — authenticate, authorize,
// lazily generate the versioned JPEG thumbnail, and serve the cached bytes.
func (h *FileHandler) ServeThumb(c *gin.Context) {
	if h.thumbFlight == nil {
		h.thumbFlight = newThumbFlight()
	}

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

	img, err := h.accessibleImageByHash(userID, hash, isAdmin(c))
	if err != nil {
		fileError(c, http.StatusNotFound, "image not found", "NOT_FOUND")
		return
	}

	thumbKey := storage.ThumbKeyForHash(hash)
	thumbData, err := h.loadThumbBytes(c.Request.Context(), thumbKey)
	if err == nil {
		h.backfillThumbPath(c.Request.Context(), img, thumbKey)
		h.writeThumbResponse(c, thumbData)
		return
	}
	if !errors.Is(err, storage.ErrNotFound) {
		fileError(c, http.StatusInternalServerError, "failed to read thumb", "THUMB_READ_FAILED")
		return
	}

	thumbData, err = h.thumbFlight.Do(hash, func() ([]byte, error) {
		if cached, loadErr := h.loadThumbBytes(c.Request.Context(), thumbKey); loadErr == nil {
			return cached, nil
		}
		return h.generateAndStoreThumb(c.Request.Context(), img, thumbKey)
	})
	if err != nil {
		switch {
		case errors.Is(err, storage.ErrNotFound):
			fileError(c, http.StatusNotFound, "image not found", "NOT_FOUND")
		default:
			fileError(c, http.StatusInternalServerError, "failed to generate thumbnail", "THUMB_FAILED")
		}
		return
	}

	h.backfillThumbPath(c.Request.Context(), img, thumbKey)
	h.writeThumbResponse(c, thumbData)
}

func (h *FileHandler) accessibleImageByHash(userID uuid.UUID, hash string, admin bool) (*models.Image, error) {
	if admin {
		return h.imageService.GetByHash(hash)
	}
	own, ok := h.imageService.HashExistsForUser(userID, hash)
	if ok {
		return own, nil
	}
	return nil, errors.New("not found")
}

func (h *FileHandler) generateAndStoreThumb(ctx context.Context, img *models.Image, thumbKey string) ([]byte, error) {
	src, err := openSourceForThumb(ctx, h.storage, img)
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			return nil, storage.ErrNotFound
		}
		return nil, err
	}
	defer src.Close()

	thumbData, err := generateThumbnail(src, img.MimeType)
	if err != nil {
		return nil, err
	}

	prevThumbPath := img.ThumbPath
	if err := h.storage.SaveThumb(ctx, thumbKey, bytes.NewReader(thumbData)); err != nil {
		return nil, err
	}

	if img.ThumbPath != thumbKey {
		img.ThumbPath = thumbKey
		_ = h.imageService.UpdateThumbPath(img)
	}
	if prevThumbPath != "" && prevThumbPath != thumbKey {
		_ = h.storage.DeleteThumb(ctx, prevThumbPath)
	}

	return thumbData, nil
}

func (h *FileHandler) loadThumbBytes(ctx context.Context, thumbKey string) ([]byte, error) {
	stream, err := h.storage.OpenThumb(ctx, thumbKey)
	if err != nil {
		return nil, err
	}
	defer stream.Close()
	return io.ReadAll(stream)
}

func (h *FileHandler) backfillThumbPath(ctx context.Context, img *models.Image, thumbKey string) {
	if img.ThumbPath == thumbKey {
		return
	}
	prevThumbPath := img.ThumbPath
	img.ThumbPath = thumbKey
	if err := h.imageService.UpdateThumbPath(img); err != nil {
		img.ThumbPath = prevThumbPath
		return
	}
	if prevThumbPath != "" && prevThumbPath != thumbKey {
		_ = h.storage.DeleteThumb(ctx, prevThumbPath)
	}
}

func (h *FileHandler) writeThumbResponse(c *gin.Context, thumbData []byte) {
	etag := thumbETag(thumbData)
	c.Header("Content-Type", "image/jpeg")
	c.Header("Cache-Control", thumbCacheControl)
	c.Header("ETag", etag)
	if matchesETag(c.GetHeader("If-None-Match"), etag) {
		c.AbortWithStatus(http.StatusNotModified)
		return
	}
	c.Data(http.StatusOK, "image/jpeg", thumbData)
}

func thumbETag(data []byte) string {
	sum := sha256.Sum256(data)
	return `"` + hex.EncodeToString(sum[:]) + `"`
}

func matchesETag(headerValue, etag string) bool {
	headerValue = strings.TrimSpace(headerValue)
	if headerValue == "" {
		return false
	}
	for _, candidate := range strings.Split(headerValue, ",") {
		candidate = strings.TrimSpace(candidate)
		if candidate == etag || candidate == "W/"+etag || strings.TrimPrefix(candidate, "W/") == etag {
			return true
		}
	}
	return false
}

// openSourceForThumb returns a reader positioned at the start of the original
// image bytes, regardless of the underlying storage driver. The local driver
// keeps the existing fast-path that opens the file on disk directly so the
// thumbnail generator can use the OS page cache.
func openSourceForThumb(ctx context.Context, s storage.Storage, img *models.Image) (io.ReadCloser, error) {
	if local, ok := s.(*storage.LocalStorage); ok {
		// The Image row may store either an absolute path (legacy rows
		// written before the storage refactor) or a relative key
		// ("2026/06/..._..._<hash>.jpg"). LocalStorage.Path returns the
		// correct on-disk path in both cases.
		p, pathErr := local.Path(img.Path)
		if pathErr != nil {
			return nil, pathErr
		}
		return openFile(p)
	}
	return s.Open(ctx, img.Path)
}

// generateThumbnail is the bytes-based entry point for thumbnail generation;
// the underlying logic lives in thumbnail.go alongside the resize helpers.
func generateThumbnail(r io.Reader, mimeType string) ([]byte, error) {
	return generateThumbnailFromReader(r, mimeType)
}
