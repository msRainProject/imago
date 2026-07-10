package handler

import (
	"net/http"

	"hill-images/internal/service"

	"github.com/gin-gonic/gin"
)

// ImageHandler handles image endpoints.
type ImageHandler struct {
	imageService *service.ImageService
}

// NewImageHandler creates a new ImageHandler.
func NewImageHandler(imageService *service.ImageService) *ImageHandler {
	return &ImageHandler{imageService: imageService}
}

// List handles GET /api/images.
func (h *ImageHandler) List(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

// Get handles GET /api/images/:id.
func (h *ImageHandler) Get(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

// Upload handles POST /api/images/upload.
func (h *ImageHandler) Upload(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

// Delete handles DELETE /api/images/:id.
func (h *ImageHandler) Delete(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}
