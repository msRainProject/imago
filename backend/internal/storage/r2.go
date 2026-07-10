package storage

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"time"

	awsv2 "github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	awscreds "github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// R2Config holds the R2 driver configuration. It is the same struct used by
// config.Config and the admin config repo; see internal/config.
type R2Config struct {
	AccountID       string
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
	PublicBaseURL   string
	Region          string
}

// R2Storage implements Storage against a Cloudflare R2 bucket using the S3
// compatible API exposed by the AWS SDK v2.
type R2Storage struct {
	client      *s3.Client
	presigner   *s3.PresignClient
	bucket      string
	keyPrefix   string
	thumbPrefix string
	publicBase  string
	region      string
}

// NewR2Storage constructs an R2-backed storage driver. The S3 client is
// configured with a static credentials provider and a custom endpoint resolver
// pointing at <account_id>.r2.cloudflarestorage.com. R2 only accepts the
// dummy region "auto" for SigV4, so we force that unless the caller passed
// something explicit.
func NewR2Storage(ctx context.Context, cfg R2Config) (*R2Storage, error) {
	if cfg.AccountID == "" {
		return nil, errors.New("r2: account_id is required")
	}
	if cfg.Bucket == "" {
		return nil, errors.New("r2: bucket is required")
	}
	if cfg.AccessKeyID == "" || cfg.SecretAccessKey == "" {
		return nil, errors.New("r2: access_key_id and secret_access_key are required")
	}

	region := cfg.Region
	if region == "" {
		region = "auto"
	}

	endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", cfg.AccountID)

	awsCfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(region),
		awsconfig.WithCredentialsProvider(
			awscreds.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("r2: load aws config: %w", err)
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.BaseEndpoint = awsv2.String(endpoint)
		o.UsePathStyle = true
		// Disable checksum / middleware that R2 does not implement.
		o.DisableMultiRegionAccessPoints = true
	})
	presigner := s3.NewPresignClient(client)

	return &R2Storage{
		client:      client,
		presigner:   presigner,
		bucket:      cfg.Bucket,
		keyPrefix:   "originals",
		thumbPrefix: "thumbs",
		publicBase:  strings.TrimRight(cfg.PublicBaseURL, "/"),
		region:      region,
	}, nil
}

// Driver returns "r2".
func (s *R2Storage) Driver() string { return DriverR2 }

// objectKey converts a logical key into the R2-side key. A small namespace
// prefix keeps originals and thumbs apart and lets lifecycle rules target them
// independently.
func (s *R2Storage) objectKey(key string) string {
	return s.keyPrefix + "/" + sanitize(key)
}

func (s *R2Storage) thumbKey(key string) string {
	return s.thumbPrefix + "/" + sanitize(key)
}

// sanitize strips path-traversal characters from a logical key. R2 is a flat
// keyspace; "../../etc/passwd" is a valid key name, but we never want to give
// a caller the ability to push objects outside the namespace.
func sanitize(key string) string {
	key = strings.TrimLeft(key, "/")
	key = filepath.ToSlash(key)
	// Collapse repeated slashes.
	for strings.Contains(key, "//") {
		key = strings.ReplaceAll(key, "//", "/")
	}
	// Drop parent traversal segments.
	for strings.Contains(key, "../") {
		key = strings.ReplaceAll(key, "../", "")
	}
	return key
}

// Save uploads the object via PutObject.
func (s *R2Storage) Save(ctx context.Context, key string, data io.Reader, contentType string) error {
	body, err := io.ReadAll(data)
	if err != nil {
		return fmt.Errorf("r2: read payload: %w", err)
	}
	input := &s3.PutObjectInput{
		Bucket:      awsv2.String(s.bucket),
		Key:         awsv2.String(s.objectKey(key)),
		Body:        bytes.NewReader(body),
		ContentType: awsv2.String(contentType),
	}
	if _, err := s.client.PutObject(ctx, input); err != nil {
		return fmt.Errorf("r2: put object %q: %w", key, err)
	}
	return nil
}

// SaveThumb uploads a thumbnail.
func (s *R2Storage) SaveThumb(ctx context.Context, key string, data io.Reader) error {
	body, err := io.ReadAll(data)
	if err != nil {
		return fmt.Errorf("r2: read thumb payload: %w", err)
	}
	input := &s3.PutObjectInput{
		Bucket:      awsv2.String(s.bucket),
		Key:         awsv2.String(s.thumbKey(key)),
		Body:        bytes.NewReader(body),
		ContentType: awsv2.String("image/webp"),
	}
	if _, err := s.client.PutObject(ctx, input); err != nil {
		return fmt.Errorf("r2: put thumb %q: %w", key, err)
	}
	return nil
}

// Delete removes the original object. A "not found" is treated as success:
// callers that race a delete with an expiry policy should not see spurious
// errors.
func (s *R2Storage) Delete(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: awsv2.String(s.bucket),
		Key:    awsv2.String(s.objectKey(key)),
	})
	if err != nil {
		var notFound *s3types.NoSuchKey
		if errors.As(err, &notFound) {
			return nil
		}
		return fmt.Errorf("r2: delete object %q: %w", key, err)
	}
	return nil
}

// DeleteThumb removes a thumbnail.
func (s *R2Storage) DeleteThumb(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: awsv2.String(s.bucket),
		Key:    awsv2.String(s.thumbKey(key)),
	})
	if err != nil {
		var notFound *s3types.NoSuchKey
		if errors.As(err, &notFound) {
			return nil
		}
		return fmt.Errorf("r2: delete thumb %q: %w", key, err)
	}
	return nil
}

// Open downloads the object and returns a streaming reader.
func (s *R2Storage) Open(ctx context.Context, key string) (io.ReadCloser, error) {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: awsv2.String(s.bucket),
		Key:    awsv2.String(s.objectKey(key)),
	})
	if err != nil {
		var notFound *s3types.NoSuchKey
		if errors.As(err, &notFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("r2: get object %q: %w", key, err)
	}
	return out.Body, nil
}

// OpenThumb downloads a thumbnail.
func (s *R2Storage) OpenThumb(ctx context.Context, key string) (io.ReadCloser, error) {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: awsv2.String(s.bucket),
		Key:    awsv2.String(s.thumbKey(key)),
	})
	if err != nil {
		var notFound *s3types.NoSuchKey
		if errors.As(err, &notFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("r2: get thumb %q: %w", key, err)
	}
	return out.Body, nil
}

// PublicURL returns the public URL for the given key. When a public base URL
// is configured (e.g. a custom domain bound to the R2 bucket, or the
// r2.dev public dev URL), the client can fetch the object directly. When no
// public base URL is configured we fall back to the proxy path so the upload
// response is always a working URL.
func (s *R2Storage) PublicURL(key string) string {
	return s.publicURLFor(s.objectKey(key))
}

// ThumbURL mirrors PublicURL for thumbnails.
func (s *R2Storage) ThumbURL(key string) string {
	return s.publicURLFor(s.thumbKey(key))
}

func (s *R2Storage) publicURLFor(storedKey string) string {
	if s.publicBase == "" {
		return s.presignedURL(storedKey)
	}
	return s.publicBase + "/" + storedKey
}

func (s *R2Storage) presignedURL(storedKey string) string {
	out, err := s.presigner.PresignGetObject(context.Background(), &s3.GetObjectInput{
		Bucket: awsv2.String(s.bucket),
		Key:    awsv2.String(storedKey),
	}, func(opts *s3.PresignOptions) {
		opts.Expires = 24 * time.Hour
	})
	if err != nil {
		return "/api/files/thumb/" + sanitize(strings.TrimPrefix(storedKey, s.keyPrefix+"/"))
	}
	return out.URL
}
