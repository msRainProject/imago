package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	_ "golang.org/x/image/webp"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type UploadProcessingConfig struct {
	Enabled      bool
	TargetFormat string
	MaxSizeMB    float64
	MaxWidth     int
	MaxHeight    int
}

type ProcessedMedia struct {
	Data        []byte
	ContentType string
	Ext         string
	Width       int
	Height      int
}

type MediaProcessor struct {
	ffmpegPath      string
	heifConvertPath string
	dcrawPath       string
}

type MediaDependencyStatus struct {
	Name           string `json:"name"`
	Command        string `json:"command"`
	DebianPackage  string `json:"debian_package"`
	Required       bool   `json:"required"`
	Installed      bool   `json:"installed"`
	Path           string `json:"path"`
	InstallCommand string `json:"install_command"`
}

func NewMediaProcessor(ffmpegPath string) *MediaProcessor {
	if strings.TrimSpace(ffmpegPath) == "" {
		ffmpegPath = "ffmpeg"
	}
	heifConvertPath, _ := exec.LookPath("heif-convert")
	dcrawPath, _ := exec.LookPath("dcraw")
	return &MediaProcessor{
		ffmpegPath:      ffmpegPath,
		heifConvertPath: heifConvertPath,
		dcrawPath:       dcrawPath,
	}
}

func (p *MediaProcessor) DependencyStatus() []MediaDependencyStatus {
	return []MediaDependencyStatus{
		p.dependencyStatus("ffmpeg", p.ffmpegPath, "ffmpeg", true),
		p.dependencyStatus("heif-convert", "heif-convert", "libheif-examples", false),
		p.dependencyStatus("dcraw", "dcraw", "dcraw", false),
	}
}

func (p *MediaProcessor) dependencyStatus(name string, command string, debianPackage string, required bool) MediaDependencyStatus {
	status := MediaDependencyStatus{
		Name:           name,
		Command:        command,
		DebianPackage:  debianPackage,
		Required:       required,
		InstallCommand: "sudo apt-get update && sudo apt-get install -y ffmpeg libheif-examples dcraw",
	}

	if command == "" {
		return status
	}
	path, err := exec.LookPath(command)
	if err != nil {
		return status
	}
	status.Installed = true
	status.Path = path
	return status
}

func (p *MediaProcessor) ProcessImage(
	ctx context.Context,
	data []byte,
	filename string,
	contentType string,
	cfg UploadProcessingConfig,
) (*ProcessedMedia, error) {
	if !cfg.Enabled || !shouldServerProcessImage(filename, contentType, cfg) {
		return nil, nil
	}

	outputFormat := resolveOutputFormat(filename, contentType, cfg.TargetFormat)
	if outputFormat == "" {
		return nil, nil
	}

	tmpDir, err := os.MkdirTemp("", "hill-images-process-*")
	if err != nil {
		return nil, fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	inputPath := filepath.Join(tmpDir, "source"+preferredInputExt(filename, contentType))
	if err := os.WriteFile(inputPath, data, 0o600); err != nil {
		return nil, fmt.Errorf("write source file: %w", err)
	}

	if isDNGLike(filename, contentType) {
		normalizedPath := filepath.Join(tmpDir, "normalized-source.png")
		if err := p.normalizeDNGToPNG(ctx, inputPath, normalizedPath); err != nil {
			return nil, err
		}
		inputPath = normalizedPath
	}

	if isHEICLike(filename, contentType) && outputFormat == "webp" {
		normalizedPath := filepath.Join(tmpDir, "normalized-source.png")
		if err := p.normalizeHEICForWebP(ctx, inputPath, normalizedPath); err != nil {
			return nil, err
		}
		inputPath = normalizedPath
	}

	targetMB := cfg.MaxSizeMB
	if targetMB < 0.01 {
		targetMB = 0.01
	}
	targetBytes := int64(targetMB * 1024 * 1024)
	scaleSteps := []float64{1, 0.92, 0.84, 0.76, 0.68, 0.6}
	qualities := qualitySteps(outputFormat)

	var best []byte
	for _, scale := range scaleSteps {
		for _, quality := range qualities {
			outputPath := filepath.Join(tmpDir, fmt.Sprintf("output-%0.2f-%d.%s", scale, quality, outputFormat))
			if err := p.runFFmpeg(ctx, inputPath, outputPath, outputFormat, cfg, scale, quality); err != nil {
				return nil, err
			}
			current, err := os.ReadFile(outputPath)
			if err != nil {
				return nil, fmt.Errorf("read processed image: %w", err)
			}
			if len(current) == 0 {
				continue
			}
			if len(best) == 0 || len(current) < len(best) {
				best = current
			}
			if int64(len(current)) <= targetBytes {
				best = current
				goto done
			}
		}
	}

done:
	if len(best) == 0 {
		return nil, errors.New("ffmpeg produced no output")
	}

	width, height, err := decodeDimensions(best)
	if err != nil {
		return nil, fmt.Errorf("decode processed image dimensions: %w", err)
	}

	return &ProcessedMedia{
		Data:        best,
		ContentType: mimeFromOutputFormat(outputFormat),
		Ext:         "." + outputFormat,
		Width:       width,
		Height:      height,
	}, nil
}

func (p *MediaProcessor) runFFmpeg(
	ctx context.Context,
	inputPath string,
	outputPath string,
	outputFormat string,
	cfg UploadProcessingConfig,
	scale float64,
	quality int,
) error {
	ffmpegCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()

	args := []string{"-y", "-i", inputPath, "-frames:v", "1"}
	if filter := buildScaleFilter(cfg, scale); filter != "" {
		args = append(args, "-vf", filter)
	}

	switch outputFormat {
	case "jpg", "jpeg":
		args = append(args, "-pix_fmt", "yuvj420p", "-q:v", fmt.Sprintf("%d", quality))
	case "webp":
		args = append(args, "-c:v", "libwebp", "-pix_fmt", "yuv420p", "-q:v", fmt.Sprintf("%d", quality))
	case "png":
		args = append(args, "-compression_level", fmt.Sprintf("%d", quality))
	}

	args = append(args, outputPath)
	cmd := exec.CommandContext(ffmpegCtx, p.ffmpegPath, args...)
	var stderr bytes.Buffer
	cmd.Stdout = io.Discard
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("ffmpeg failed: %s", msg)
	}
	return nil
}

func (p *MediaProcessor) normalizeHEICForWebP(ctx context.Context, inputPath string, outputPath string) error {
	if p.heifConvertPath != "" {
		if err := p.normalizeHEICWithLibheif(ctx, inputPath, outputPath); err == nil {
			return nil
		}
	}
	return p.normalizeHEICToJPEGFallback(ctx, inputPath, outputPath)
}

func (p *MediaProcessor) normalizeHEICWithLibheif(ctx context.Context, inputPath string, outputPath string) error {
	convertCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(convertCtx, p.heifConvertPath, inputPath, outputPath)
	var stderr bytes.Buffer
	cmd.Stdout = io.Discard
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("heif-convert failed: %s", msg)
	}
	return nil
}

func (p *MediaProcessor) normalizeHEICToJPEGFallback(ctx context.Context, inputPath string, outputPath string) error {
	ffmpegCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()

	args := []string{
		"-y",
		"-i", inputPath,
		"-frames:v", "1",
		"-pix_fmt", "yuvj420p",
		"-q:v", "2",
		strings.TrimSuffix(outputPath, filepath.Ext(outputPath)) + ".jpg",
	}
	cmd := exec.CommandContext(ffmpegCtx, p.ffmpegPath, args...)
	var stderr bytes.Buffer
	cmd.Stdout = io.Discard
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("ffmpeg normalize heic failed: %s", msg)
	}
	jpegPath := strings.TrimSuffix(outputPath, filepath.Ext(outputPath)) + ".jpg"
	return p.runFFmpeg(ctx, jpegPath, outputPath, "png", UploadProcessingConfig{}, 1, 9)
}

func (p *MediaProcessor) normalizeDNGToPNG(ctx context.Context, inputPath string, outputPath string) error {
	if p.dcrawPath == "" {
		return errors.New("dcraw not installed")
	}

	convertCtx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()

	ppmPath := strings.TrimSuffix(outputPath, filepath.Ext(outputPath)) + ".ppm"
	ppmFile, err := os.Create(ppmPath)
	if err != nil {
		return fmt.Errorf("create dcraw output: %w", err)
	}

	cmd := exec.CommandContext(convertCtx, p.dcrawPath, "-c", "-w", inputPath)
	var stderr bytes.Buffer
	cmd.Stdout = ppmFile
	cmd.Stderr = &stderr
	runErr := cmd.Run()
	closeErr := ppmFile.Close()
	if runErr != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = runErr.Error()
		}
		return fmt.Errorf("dcraw failed: %s", msg)
	}
	if closeErr != nil {
		return fmt.Errorf("finalize dcraw output: %w", closeErr)
	}

	return p.runFFmpeg(ctx, ppmPath, outputPath, "png", UploadProcessingConfig{}, 1, 9)
}

func shouldServerProcessImage(filename string, contentType string, cfg UploadProcessingConfig) bool {
	if isDNGLike(filename, contentType) {
		return true
	}
	if !strings.HasPrefix(strings.ToLower(strings.TrimSpace(contentType)), "image/") {
		return false
	}
	if strings.EqualFold(contentType, "image/gif") {
		return cfg.TargetFormat != "original"
	}
	if cfg.TargetFormat != "original" {
		return true
	}
	return isHEICLike(filename, contentType)
}

func resolveOutputFormat(filename string, contentType string, target string) string {
	switch strings.ToLower(strings.TrimSpace(target)) {
	case "jpeg", "jpg":
		return "jpg"
	case "png":
		return "png"
	case "webp":
		return "webp"
	}

	if isHEICLike(filename, contentType) {
		return "jpg"
	}
	if isDNGLike(filename, contentType) {
		switch strings.ToLower(strings.TrimSpace(target)) {
		case "png":
			return "png"
		case "webp":
			return "webp"
		default:
			return "jpg"
		}
	}

	ext := strings.TrimPrefix(strings.ToLower(filepath.Ext(filename)), ".")
	switch ext {
	case "jpg", "jpeg":
		return "jpg"
	case "png":
		return "png"
	case "webp":
		return "webp"
	case "bmp":
		return "png"
	default:
		return "jpg"
	}
}

func preferredInputExt(filename string, contentType string) string {
	ext := filepath.Ext(filename)
	if ext != "" {
		return ext
	}
	switch strings.ToLower(strings.TrimSpace(contentType)) {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/heic":
		return ".heic"
	case "image/heif":
		return ".heif"
	case "image/x-adobe-dng", "image/dng", "application/x-adobe-dng":
		return ".dng"
	default:
		return ".img"
	}
}

func buildScaleFilter(cfg UploadProcessingConfig, scale float64) string {
	maxWidth := int(float64(maxInt(cfg.MaxWidth, 0)) * scale)
	maxHeight := int(float64(maxInt(cfg.MaxHeight, 0)) * scale)

	if maxWidth <= 0 && maxHeight <= 0 {
		if scale >= 0.999 {
			return ""
		}
		maxWidth = -2
		maxHeight = int(float64(4096) * scale)
	}

	widthExpr := "iw"
	heightExpr := "ih"
	if maxWidth > 0 {
		widthExpr = fmt.Sprintf("min(iw\\,%d)", maxWidth)
	}
	if maxHeight > 0 {
		heightExpr = fmt.Sprintf("min(ih\\,%d)", maxHeight)
	}
	return fmt.Sprintf("scale=%s:%s:force_original_aspect_ratio=decrease", widthExpr, heightExpr)
}

func qualitySteps(format string) []int {
	switch format {
	case "jpg", "jpeg":
		return []int{2, 4, 6, 8, 10, 14, 18, 22}
	case "webp":
		return []int{92, 86, 80, 74, 68, 62, 56}
	case "png":
		return []int{9, 9, 9, 9, 9, 9, 9}
	default:
		return []int{2}
	}
}

func decodeDimensions(data []byte) (int, int, error) {
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return 0, 0, err
	}
	return cfg.Width, cfg.Height, nil
}

func mimeFromOutputFormat(format string) string {
	switch format {
	case "jpg", "jpeg":
		return "image/jpeg"
	case "png":
		return "image/png"
	case "webp":
		return "image/webp"
	default:
		return "application/octet-stream"
	}
}

func isHEICLike(filename string, contentType string) bool {
	name := strings.ToLower(filename)
	mime := strings.ToLower(strings.TrimSpace(contentType))
	return mime == "image/heic" || mime == "image/heif" || strings.HasSuffix(name, ".heic") || strings.HasSuffix(name, ".heif")
}

func isDNGLike(filename string, contentType string) bool {
	name := strings.ToLower(filename)
	mime := strings.ToLower(strings.TrimSpace(contentType))
	return mime == "image/x-adobe-dng" || mime == "image/dng" || mime == "application/x-adobe-dng" || strings.HasSuffix(name, ".dng")
}

func maxInt(a int, b int) int {
	if a > b {
		return a
	}
	return b
}
