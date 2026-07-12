package handler

import (
	"bytes"
	"crypto/sha256"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"hill-images/internal/models"
	"hill-images/internal/service"
	"hill-images/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (h *FileHandler) Upload(c *gin.Context) {
	userID, exists := getUserID(c)
	if !exists {
		uid, ok := h.apiTokenAuth(c)
		if !ok {
			fileError(c, http.StatusUnauthorized, "unauthorized", "AUTH_FAILED")
			return
		}
		userID = uid
		c.Set("user_id", userID)
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadSize)

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		log.Printf("[upload] FormFile error: %v", err)
		fileError(c, http.StatusBadRequest, "file required", "VALIDATION_ERROR")
		return
	}
	defer file.Close()

	// Read first so we can sniff content. Size is still capped by MaxBytesReader above.
	data, err := io.ReadAll(file)
	if err != nil {
		log.Printf("[upload] read error: %v", err)
		fileError(c, http.StatusBadRequest, "failed to read file", "READ_FAILED")
		return
	}

	if int64(len(data)) > maxUploadSize {
		log.Printf("[upload] file too large: %d bytes (max %d)", len(data), maxUploadSize)
		fileError(c, http.StatusRequestEntityTooLarge, "file too large (max 100MB)", "FILE_TOO_LARGE")
		return
	}

	declared := header.Header.Get("Content-Type")
	contentType, err := resolveUploadMIME(header.Filename, declared, data)
	if err != nil {
		log.Printf("[upload] mime reject file=%s declared=%s: %v", header.Filename, declared, err)
		fileError(c, http.StatusBadRequest, err.Error(), "INVALID_MIME")
		return
	}
	log.Printf("[upload] file=%s type=%s size=%d", header.Filename, contentType, len(data))

	processCfg := h.readUploadClientConfig()
	processedExt := ""
	if h.mediaProcessor != nil {
		processed, err := h.mediaProcessor.ProcessImage(c.Request.Context(), data, header.Filename, contentType, service.UploadProcessingConfig{
			Enabled:      processCfg.Enabled,
			TargetFormat: processCfg.TargetFormat,
			MaxSizeMB:    processCfg.MaxSizeMB,
			MaxWidth:     processCfg.MaxWidth,
			MaxHeight:    processCfg.MaxHeight,
		})
		if err != nil {
			log.Printf("[upload] process error: %v", err)
			fileError(c, http.StatusBadRequest, "failed to process image", "PROCESS_FAILED")
			return
		}
		if processed != nil {
			data = processed.Data
			contentType = processed.ContentType
			processedExt = processed.Ext
		}
	}

	hash := fmt.Sprintf("%x", sha256.Sum256(data))

	if existing, found := h.imageService.HashExists(hash); found {
		fileSuccess(c, gin.H{
			"hash":   existing.Hash,
			"url":    storageResponseURL(h.storage, existing.Path, existing.Hash),
			"size":   existing.Size,
			"width":  existing.Width,
			"height": existing.Height,
		})
		return
	}

	now := time.Now()
	ext := processedExt
	if ext == "" {
		ext = filepath.Ext(header.Filename)
	}
	if ext == "" {
		ext = extensionFromMIME(contentType)
	}
	if ext == "" || ext == ".bin" {
		if normalizedExt := extensionFromMIME(contentType); normalizedExt != ".bin" {
			ext = normalizedExt
		}
	}

	var key string
	apiKeyName, hasAPIKey := c.Get("api_key_name")

	if hasAPIKey {
		appName := apiKeyName.(string)
		folder := c.Query("folder")
		filename := storage.RandomTokenN(12) + ext
		key, err = buildAPIKeyStorageKey(h.storage, appName, folder, filename)
		if err != nil {
			// Path sanitization failures are client errors, not server faults.
			msg := err.Error()
			if strings.Contains(msg, "invalid") || strings.Contains(msg, "folder") || strings.Contains(msg, "path") {
				fileError(c, http.StatusBadRequest, msg, "INVALID_FOLDER")
				return
			}
			fileError(c, http.StatusInternalServerError, "failed to build storage key", "KEY_BUILD_FAILED")
			return
		}
	} else {
		filename := fmt.Sprintf("%s_%s_%s%s",
			now.Format("20060102150405"),
			uuid.New().String()[:8],
			hash[:12],
			ext,
		)
		key, err = buildStorageKey(h.storage, header.Filename, hash, ext, now, filename)
		if err != nil {
			fileError(c, http.StatusInternalServerError, "failed to build storage key", "KEY_BUILD_FAILED")
			return
		}
	}

	if err := h.storage.Save(c.Request.Context(), key, bytes.NewReader(data), contentType); err != nil {
		fileError(c, http.StatusInternalServerError, "failed to save file", "SAVE_FAILED")
		return
	}

	width, height := extractDimensions(data, contentType)

	img := &models.Image{
		UserID:        userID,
		Hash:          hash,
		Filename:      filepath.Base(key),
		OriginalName:  header.Filename,
		Path:          key,
		Size:          int64(len(data)),
		MimeType:      contentType,
		Width:         width,
		Height:        height,
		StorageDriver: h.storage.Driver(),
	}

	if err := h.imageService.Create(img); err != nil {
		if existing, found := h.imageService.HashExists(hash); found {
			_ = h.storage.Delete(c.Request.Context(), key)
			fileSuccess(c, gin.H{
				"hash":   existing.Hash,
				"url":    storageResponseURL(h.storage, existing.Path, existing.Hash),
				"size":   existing.Size,
				"width":  existing.Width,
				"height": existing.Height,
			})
			return
		}
		_ = h.storage.Delete(c.Request.Context(), key)
		fileError(c, http.StatusInternalServerError, "failed to create image record", "DB_ERROR")
		return
	}

	if hasAPIKey {
		if apiKeyID, ok := c.Get("api_key_id"); ok {
			if id, parsed := apiKeyID.(uuid.UUID); parsed {
				_ = h.apiKeyRepo.IncrementUploadStats(id, int64(len(data)))
			}
		}
	}

	fileSuccess(c, gin.H{
		"hash":   hash,
		"url":    storageResponseURL(h.storage, key, hash),
		"size":   img.Size,
		"width":  width,
		"height": height,
	})
}
