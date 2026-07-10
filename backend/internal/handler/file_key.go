package handler

import (
	"fmt"
	"path/filepath"
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
	if local, ok := s.(*storage.LocalStorage); ok {
		return local.BuildAPIKey(appName, folder, filename)
	}
	parts := []string{appName}
	if folder != "" {
		parts = append(parts, folder)
	}
	parts = append(parts, filename)
	return filepath.ToSlash(filepath.Join(parts...)), nil
}
