package handler

import (
	"bytes"
	"image"
	"image/color"
	stddraw "image/draw"
	"image/gif"
	"image/jpeg"
	"io"
	"os"

	xdraw "golang.org/x/image/draw"
	"golang.org/x/image/webp"
)

const thumbMaxSide = 320

// generateThumbnailFromReader creates a versioned thumbnail from the source
// image. Output is always encoded as JPEG so the response content type matches
// the stored bytes.
//
// This is the driver-agnostic variant: the handler passes the source as an
// io.Reader so the same code works for local files and R2 downloads.
func generateThumbnailFromReader(src io.Reader, mimeType string) ([]byte, error) {
	img, err := decodeImage(src, mimeType)
	if err != nil {
		return nil, err
	}

	thumb := resizeToMaxSide(img, thumbMaxSide)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, thumb, &jpeg.Options{Quality: 85}); err != nil {
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
	stddraw.Draw(canvas, bounds, g.Image[0], bounds.Min, stddraw.Src)
	return canvas, nil
}

// resizeToMaxSide resizes an image so its longest edge is at most maxSide,
// preserving aspect ratio with a high-quality resampler. JPEG cannot retain
// alpha, so transparent pixels are composited onto white.
func resizeToMaxSide(src image.Image, maxSide int) image.Image {
	origBounds := src.Bounds()
	origW := origBounds.Dx()
	origH := origBounds.Dy()
	if origW <= 0 || origH <= 0 {
		return src
	}

	targetWidth := origW
	targetHeight := origH
	if origW > maxSide || origH > maxSide {
		scale := float64(maxSide) / float64(maxInt(origW, origH))
		targetWidth = int(float64(origW) * scale)
		targetHeight = int(float64(origH) * scale)
	}
	if targetWidth < 1 {
		targetWidth = 1
	}
	if targetHeight < 1 {
		targetHeight = 1
	}
	dst := image.NewRGBA(image.Rect(0, 0, targetWidth, targetHeight))
	stddraw.Draw(dst, dst.Bounds(), image.NewUniform(color.White), image.Point{}, stddraw.Src)
	if targetWidth == origW && targetHeight == origH {
		stddraw.Draw(dst, dst.Bounds(), src, origBounds.Min, stddraw.Over)
	} else {
		xdraw.CatmullRom.Scale(dst, dst.Bounds(), src, origBounds, stddraw.Over, nil)
	}
	return dst
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// osStat and openFile are thin shims around the os package so the rest of the
// handler does not need to import "os" directly.
func osStat(path string) (os.FileInfo, error) {
	return os.Stat(path)
}

func openFile(path string) (io.ReadCloser, error) {
	return os.Open(path)
}
