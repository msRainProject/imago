// Package storage provides a small abstraction over the file storage backend
// used by the image host. The current implementation supports local disk and
// Cloudflare R2 (S3-compatible). The Storage interface keeps the rest of the
// codebase driver-agnostic: handlers call Save / Open / Delete, the concrete
// implementation handles the underlying transport.
package storage

import (
	"context"
	"errors"
	"io"
)

// Driver names recognised by the configuration layer.
const (
	DriverLocal = "local"
	DriverR2    = "r2"
	DriverS3    = "s3"
)

// ErrNotFound is returned by Open when the requested object does not exist.
var ErrNotFound = errors.New("storage: object not found")

// Storage is the abstract contract every backend driver must implement.
//
// Keys are driver-scoped relative identifiers (filesystem paths for Local,
// object keys for R2). They are the single piece of information persisted on
// the Image row; everything else lives behind this interface.
type Storage interface {
	// Driver returns the driver name persisted in image rows
	// (matches the constants above).
	Driver() string

	// Save uploads an object identified by key. contentType is advisory
	// and may be empty; drivers that ignore it MUST not fail.
	Save(ctx context.Context, key string, data io.Reader, contentType string) error

	// SaveThumb uploads a thumbnail object. Thumbs are kept on a separate
	// key namespace so they can be cleaned independently.
	SaveThumb(ctx context.Context, key string, data io.Reader) error

	// Delete removes the original object. Missing objects are not an
	// error: a missing object cannot be un-deleted, so callers can rely
	// on Delete returning nil after a successful prior delete.
	Delete(ctx context.Context, key string) error

	// DeleteThumb removes a thumbnail object.
	DeleteThumb(ctx context.Context, key string) error

	// Open returns a stream of the object's bytes. Callers MUST close it.
	// Returns ErrNotFound when the object does not exist.
	Open(ctx context.Context, key string) (io.ReadCloser, error)

	// OpenThumb returns a stream of a thumbnail object's bytes.
	OpenThumb(ctx context.Context, key string) (io.ReadCloser, error)

	// PublicURL returns the URL the upload response should advertise.
	// For local mode this is the canonical pretty local URL. For R2/S3 it
	// is the configured public base URL when set, otherwise a presigned GET
	// URL.
	PublicURL(key string) string

	// ThumbURL returns the URL for a thumbnail key.
	ThumbURL(key string) string
}
