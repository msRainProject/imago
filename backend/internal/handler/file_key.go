package handler

import (
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"hill-images/internal/storage"
)

// buildStorageKey chooses the right key builder for the configured storage
// driver. The local driver is the only one that exposes a configurable path
// template today; for any other driver we use the canonical
// "year/month/<filename>" layout that the upload response, the public URL
// proxy route, and the legacy Image rows all already understand.
func buildStorageKey(s storage.Storage, originalName, hash, ext string, now time.Time, fallbackFilename string) (string, error) {
	if local, ok := s.(*storage.LocalStorage); ok {
		return local.BuildKey(fallbackFilename, hash, storage.NowFromTime(now))
	}
	return filepath.ToSlash(filepath.Join(
		fmt.Sprintf("%d", now.Year()),
		fmt.Sprintf("%02d", int(now.Month())),
		fallbackFilename,
	)), nil
}

func buildAPIKeyStorageKey(s storage.Storage, appName, folder, filename string) (string, error) {
	safeApp, err := storage.SanitizePathSegment(appName)
	if err != nil {
		return "", fmt.Errorf("invalid api key name for storage path: %w", err)
	}
	safeFolder, err := storage.SanitizeFolderPath(folder)
	if err != nil {
		return "", fmt.Errorf("invalid folder: %w", err)
	}
	// filename is server-generated (random + ext); still reject separators.
	if strings.ContainsAny(filename, `/\`) || strings.Contains(filename, "..") {
		return "", fmt.Errorf("invalid filename")
	}
	if local, ok := s.(*storage.LocalStorage); ok {
		return local.BuildAPIKey(safeApp, safeFolder, filename)
	}
	parts := []string{safeApp}
	if safeFolder != "" {
		parts = append(parts, strings.Split(safeFolder, "/")...)
	}
	parts = append(parts, filename)
	return filepath.ToSlash(filepath.Join(parts...)), nil
}
