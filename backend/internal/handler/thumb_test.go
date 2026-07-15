package handler

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestGenerateThumbnailFromReader_JPEGAndMaxSide(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 640, 480))
	for y := 0; y < 480; y++ {
		for x := 0; x < 640; x++ {
			src.Set(x, y, color.RGBA{R: uint8(x % 255), G: uint8(y % 255), B: 180, A: 255})
		}
	}

	var input bytes.Buffer
	if err := jpeg.Encode(&input, src, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatalf("encode input jpeg: %v", err)
	}

	out, err := generateThumbnailFromReader(bytes.NewReader(input.Bytes()), "image/jpeg")
	if err != nil {
		t.Fatalf("generate thumbnail: %v", err)
	}

	cfg, format, err := image.DecodeConfig(bytes.NewReader(out))
	if err != nil {
		t.Fatalf("decode config: %v", err)
	}
	if format != "jpeg" {
		t.Fatalf("expected jpeg output, got %q", format)
	}
	if cfg.Width != 320 || cfg.Height != 240 {
		t.Fatalf("expected 320x240 thumbnail, got %dx%d", cfg.Width, cfg.Height)
	}

	decoded, format, err := image.Decode(bytes.NewReader(out))
	if err != nil {
		t.Fatalf("decode output: %v", err)
	}
	if format != "jpeg" {
		t.Fatalf("expected jpeg output after decode, got %q", format)
	}
	bounds := decoded.Bounds()
	if bounds.Dx() != 320 || bounds.Dy() != 240 {
		t.Fatalf("expected decoded bounds 320x240, got %dx%d", bounds.Dx(), bounds.Dy())
	}
}

func TestGenerateThumbnailFromReader_CompositesTransparencyOnWhite(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 16, 16))

	var input bytes.Buffer
	if err := png.Encode(&input, src); err != nil {
		t.Fatalf("encode input png: %v", err)
	}

	out, err := generateThumbnailFromReader(bytes.NewReader(input.Bytes()), "image/png")
	if err != nil {
		t.Fatalf("generate thumbnail: %v", err)
	}

	decoded, err := jpeg.Decode(bytes.NewReader(out))
	if err != nil {
		t.Fatalf("decode output: %v", err)
	}
	r, g, b, _ := decoded.At(8, 8).RGBA()
	if r < 0xf000 || g < 0xf000 || b < 0xf000 {
		t.Fatalf("expected transparent pixels on white, got rgb16=(%d,%d,%d)", r, g, b)
	}
}

func TestThumbFlight_DeduplicatesConcurrentCalls(t *testing.T) {
	flight := newThumbFlight()
	var calls int32

	const goroutines = 16
	results := make(chan []byte, goroutines)
	errs := make(chan error, goroutines)

	var wg sync.WaitGroup
	wg.Add(goroutines)
	for i := 0; i < goroutines; i++ {
		go func() {
			defer wg.Done()
			data, err := flight.Do("hash-123", func() ([]byte, error) {
				atomic.AddInt32(&calls, 1)
				time.Sleep(50 * time.Millisecond)
				return []byte("ok"), nil
			})
			results <- data
			errs <- err
		}()
	}
	wg.Wait()
	close(results)
	close(errs)

	for err := range errs {
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	}
	for data := range results {
		if string(data) != "ok" {
			t.Fatalf("unexpected result %q", string(data))
		}
	}
	if got := atomic.LoadInt32(&calls); got != 1 {
		t.Fatalf("expected one generation call, got %d", got)
	}
}

func TestWriteThumbResponse_SetsCacheHeadersAndHonorsETag(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := &FileHandler{}
	body := []byte("thumb-bytes")

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/files/hash/thumb", nil)

	handler.writeThumbResponse(ctx, body)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); got != "image/jpeg" {
		t.Fatalf("unexpected content-type %q", got)
	}
	if got := rec.Header().Get("Cache-Control"); got != thumbCacheControl {
		t.Fatalf("unexpected cache-control %q", got)
	}
	etag := rec.Header().Get("ETag")
	if etag == "" {
		t.Fatal("expected ETag header")
	}
	if !strings.HasPrefix(etag, "\"") || !strings.HasSuffix(etag, "\"") {
		t.Fatalf("expected quoted etag, got %q", etag)
	}

	rec2 := httptest.NewRecorder()
	ctx2, _ := gin.CreateTestContext(rec2)
	req2 := httptest.NewRequest(http.MethodGet, "/api/files/hash/thumb", nil)
	req2.Header.Set("If-None-Match", etag)
	ctx2.Request = req2

	handler.writeThumbResponse(ctx2, body)

	if rec2.Code != http.StatusNotModified {
		t.Fatalf("expected 304, got %d", rec2.Code)
	}
	if got := rec2.Header().Get("ETag"); got != etag {
		t.Fatalf("expected matching etag, got %q", got)
	}
}
