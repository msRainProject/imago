package storage

import (
	"path/filepath"
	"strings"
	"unicode"
)

const (
	thumbVersion = "v2"
	thumbExt     = ".jpg"
)

// ThumbKeyForHash returns the versioned thumbnail object key for a content
// hash. The current thumb format is hash_v2.jpg.
func ThumbKeyForHash(hash string) string {
	return hash + "_" + thumbVersion + thumbExt
}

// thumbHashFromKey reverses the current versioned thumbnail key back to the
// original hash. Older keys without a version suffix still round-trip.
func thumbHashFromKey(key string) string {
	base := filepath.Base(key)
	name := strings.TrimSuffix(base, filepath.Ext(base))
	if idx := strings.LastIndex(name, "_v"); idx >= 0 {
		suffix := name[idx+2:]
		if suffix != "" {
			allDigits := true
			for _, r := range suffix {
				if !unicode.IsDigit(r) {
					allDigits = false
					break
				}
			}
			if allDigits {
				return name[:idx]
			}
		}
	}
	return name
}
