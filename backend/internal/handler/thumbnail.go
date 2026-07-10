package handler

import (
	"bytes"
	"image"
	"image/draw"
	"image/gif"
	"image/jpeg"
	"io"
	"os"

	"golang.org/x/image/webp"
)

// generateThumbnailFromReader creates a 300px-wide thumbnail from the source
// image. Output is encoded as JPEG at quality 80 (stored with .webp extension
// for cache key consistency). Go's stdlib lacks a WebP encoder; a production
// deployment would swap this for a libwebp CGo encoder.
//
// This is the driver-agnostic variant: the handler passes the source as an
// io.Reader so the same code works for local files and R2 downloads.
func generateThumbnailFromReader(src io.Reader, mimeType string) ([]byte, error) {
	img, err := decodeImage(src, mimeType)
	if err != nil {
		return nil, err
	}

	thumb := resizeToWidth(img, 300)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, thumb, &jpeg.Options{Quality: 80}); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

// decodeImage decodes an image file based on its MIME type.
func decodeImage(r io.Reader, mimeType string) (image.Image, error) {
	switch mimeType {
	case "image/webp":
		return webp.Decode(r)
	case "image/gif":
		return decodeGIFFirstFrame(r)
	default:
		img, _, err := image.Decode(r)
		return img, err
	}
}

// decodeGIFFirstFrame decodes the first frame of a GIF.
func decodeGIFFirstFrame(r io.Reader) (image.Image, error) {
	g, err := gif.DecodeAll(r)
	if err != nil {
		return nil, err
	}
	if len(g.Image) == 0 {
		return nil, image.ErrFormat
	}
	bounds := g.Image[0].Bounds()
	if bounds.Empty() {
		bounds = image.Rect(0, 0, 1, 1)
	}
	canvas := image.NewRGBA(bounds)
	draw.Draw(canvas, bounds, g.Image[0], bounds.Min, draw.Src)
	return canvas, nil
}

// resizeToWidth resizes an image to the target width using nearest-neighbor
// scaling.
func resizeToWidth(src image.Image, targetWidth int) image.Image {
	origBounds := src.Bounds()
	origW := origBounds.Dx()
	origH := origBounds.Dy()
	if origW <= 0 || origH <= 0 || origW <= targetWidth {
		return src
	}

	ratio := float64(targetWidth) / float64(origW)
	targetHeight := int(float64(origH) * ratio)
	if targetHeight < 1 {
		targetHeight = 1
	}

	dst := image.NewRGBA(image.Rect(0, 0, targetWidth, targetHeight))
	for y := 0; y < targetHeight; y++ {
		for x := 0; x < targetWidth; x++ {
			srcX := int(float64(x) / ratio)
			srcY := int(float64(y) / ratio)
			if srcX >= origW {
				srcX = origW - 1
			}
			if srcY >= origH {
				srcY = origH - 1
			}
			dst.Set(x, y, src.At(srcX+origBounds.Min.X, srcY+origBounds.Min.Y))
		}
	}
	return dst
}

// osStat and openFile are thin shims around the os package so the rest of the
// handler does not need to import "os" directly.
func osStat(path string) (os.FileInfo, error) {
	return os.Stat(path)
}

func openFile(path string) (io.ReadCloser, error) {
	return os.Open(path)
}
