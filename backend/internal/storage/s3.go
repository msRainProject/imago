package storage

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	awsv2 "github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	awscreds "github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// S3Config holds the generic S3-compatible storage driver configuration.
// It works with any S3-compatible service: AWS S3, Cloudflare R2, MinIO,
// Backblaze B2, DigitalOcean Spaces, etc.
type S3Config struct {
	// Endpoint is the S3-compatible API endpoint URL.
	// Examples:
	//   - AWS S3:     https://s3.us-west-2.amazonaws.com
	//   - MinIO:      https://play.min.io
	//   - Backblaze:  https://s3.us-west-004.backblazeb2.com
	//   - DO Spaces:  https://nyc3.digitaloceanspaces.com
	//   - R2:         https://<account_id>.r2.cloudflarestorage.com
	Endpoint string

	// Region is the S3 region. For services that do not use real regions
	// (e.g. R2 uses "auto", MinIO accepts any value), pass the value the
	// service expects for SigV4 signing.
	Region string

	// Bucket is the bucket name.
	Bucket string

	// AccessKeyID is the access key for S3 authentication.
	AccessKeyID string
	// SecretAccessKey is the secret key for S3 authentication.
	SecretAccessKey string

	// PublicBaseURL is the optional public-facing URL prefix for direct
	// object access via CDN or custom domain (e.g. "https://cdn.example.com").
	// When empty, the driver falls back to the in-process proxy path.
	PublicBaseURL string

	// KeyPrefix is the key namespace prefix for original objects.
	// Defaults to "originals" when empty.
	KeyPrefix string

	// ThumbPrefix is the key namespace prefix for thumbnails.
	// Defaults to "thumbs" when empty.
	ThumbPrefix string

	// UsePathStyle forces path-style addressing (e.g.
	// "https://endpoint/bucket/key") instead of virtual-hosted-style
	// ("https://bucket.endpoint/key"). Required for MinIO, R2, and many
	// self-hosted S3-compatible services. Defaults to true.
	UsePathStyle bool
}

// S3Storage implements Storage against any S3-compatible object store using
// the AWS SDK v2. It supports configurable endpoints, regions, and key
// prefixes so the same driver works with AWS S3, Cloudflare R2, MinIO, and
// other S3-compatible services.
type S3Storage struct {
	client      *s3.Client
	presigner   *s3.PresignClient
	bucket      string
	keyPrefix   string
	thumbPrefix string
	publicBase  string
	region      string
}

// NewS3Storage constructs an S3-backed storage driver. The S3 client is
// configured with static credentials and the provided endpoint. The driver
// uses path-style addressing by default (compatible with MinIO, R2, etc.).
func NewS3Storage(ctx context.Context, cfg S3Config) (*S3Storage, error) {
	if cfg.Endpoint == "" {
		return nil, errors.New("s3: endpoint is required")
	}
	if cfg.Bucket == "" {
		return nil, errors.New("s3: bucket is required")
	}
	if cfg.AccessKeyID == "" || cfg.SecretAccessKey == "" {
		return nil, errors.New("s3: access_key_id and secret_access_key are required")
	}

	region := cfg.Region
	if region == "" {
		region = "auto"
	}

	usePathStyle := true // path-style by default (required by MinIO, R2, etc.)
	if !cfg.UsePathStyle {
		usePathStyle = false
	}

	awsCfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(region),
		awsconfig.WithCredentialsProvider(
			awscreds.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("s3: load aws config: %w", err)
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.BaseEndpoint = awsv2.String(cfg.Endpoint)
		o.UsePathStyle = usePathStyle
		o.DisableMultiRegionAccessPoints = true
	})
	presigner := s3.NewPresignClient(client)

	keyPrefix := cfg.KeyPrefix
	if keyPrefix == "" {
		keyPrefix = "originals"
	}
	thumbPrefix := cfg.ThumbPrefix
	if thumbPrefix == "" {
		thumbPrefix = "thumbs"
	}

	return &S3Storage{
		client:      client,
		presigner:   presigner,
		bucket:      cfg.Bucket,
		keyPrefix:   strings.Trim(keyPrefix, "/"),
		thumbPrefix: strings.Trim(thumbPrefix, "/"),
		publicBase:  strings.TrimRight(cfg.PublicBaseURL, "/"),
		region:      region,
	}, nil
}

// Driver returns "s3".
func (s *S3Storage) Driver() string { return DriverS3 }

// objectKey converts a logical key into the S3-side key for an original.
func (s *S3Storage) objectKey(key string) string {
	return s.keyPrefix + "/" + sanitize(key)
}

// thumbKey converts a logical key into the S3-side key for a thumbnail.
func (s *S3Storage) thumbKey(key string) string {
	return s.thumbPrefix + "/" + sanitize(key)
}

// Save uploads the object via PutObject.
func (s *S3Storage) Save(ctx context.Context, key string, data io.Reader, contentType string) error {
	body, err := io.ReadAll(data)
	if err != nil {
		return fmt.Errorf("s3: read payload: %w", err)
	}
	input := &s3.PutObjectInput{
		Bucket:      awsv2.String(s.bucket),
		Key:         awsv2.String(s.objectKey(key)),
		Body:        bytes.NewReader(body),
		ContentType: awsv2.String(contentType),
	}
	if _, err := s.client.PutObject(ctx, input); err != nil {
		return fmt.Errorf("s3: put object %q: %w", key, err)
	}
	return nil
}

// SaveThumb uploads a thumbnail.
func (s *S3Storage) SaveThumb(ctx context.Context, key string, data io.Reader) error {
	body, err := io.ReadAll(data)
	if err != nil {
		return fmt.Errorf("s3: read thumb payload: %w", err)
	}
	input := &s3.PutObjectInput{
		Bucket:      awsv2.String(s.bucket),
		Key:         awsv2.String(s.thumbKey(key)),
		Body:        bytes.NewReader(body),
		ContentType: awsv2.String("image/jpeg"),
	}
	if _, err := s.client.PutObject(ctx, input); err != nil {
		return fmt.Errorf("s3: put thumb %q: %w", key, err)
	}
	return nil
}

// Delete removes the original object. A "not found" is treated as success.
func (s *S3Storage) Delete(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: awsv2.String(s.bucket),
		Key:    awsv2.String(s.objectKey(key)),
	})
	if err != nil {
		var notFound *s3types.NoSuchKey
		if errors.As(err, &notFound) {
			return nil
		}
		return fmt.Errorf("s3: delete object %q: %w", key, err)
	}
	return nil
}

// DeleteThumb removes a thumbnail.
func (s *S3Storage) DeleteThumb(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: awsv2.String(s.bucket),
		Key:    awsv2.String(s.thumbKey(key)),
	})
	if err != nil {
		var notFound *s3types.NoSuchKey
		if errors.As(err, &notFound) {
			return nil
		}
		return fmt.Errorf("s3: delete thumb %q: %w", key, err)
	}
	return nil
}

// Open downloads the object and returns a streaming reader.
func (s *S3Storage) Open(ctx context.Context, key string) (io.ReadCloser, error) {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: awsv2.String(s.bucket),
		Key:    awsv2.String(s.objectKey(key)),
	})
	if err != nil {
		var notFound *s3types.NoSuchKey
		if errors.As(err, &notFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("s3: get object %q: %w", key, err)
	}
	return out.Body, nil
}

// OpenThumb downloads a thumbnail.
func (s *S3Storage) OpenThumb(ctx context.Context, key string) (io.ReadCloser, error) {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: awsv2.String(s.bucket),
		Key:    awsv2.String(s.thumbKey(key)),
	})
	if err != nil {
		var notFound *s3types.NoSuchKey
		if errors.As(err, &notFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("s3: get thumb %q: %w", key, err)
	}
	return out.Body, nil
}

// PublicURL returns the public URL for the given key. When a public base URL
// is configured (e.g. a CDN or custom domain), the client can fetch the object
// directly. Otherwise falls back to the in-process proxy path.
func (s *S3Storage) PublicURL(key string) string {
	return s.publicURLFor(s.objectKey(key))
}

// ThumbURL mirrors PublicURL for thumbnails.
func (s *S3Storage) ThumbURL(key string) string {
	return s.publicURLFor(s.thumbKey(key))
}

func (s *S3Storage) publicURLFor(storedKey string) string {
	if s.publicBase == "" {
		return s.presignedURL(storedKey)
	}
	return s.publicBase + "/" + storedKey
}

func (s *S3Storage) presignedURL(storedKey string) string {
	out, err := s.presigner.PresignGetObject(context.Background(), &s3.GetObjectInput{
		Bucket: awsv2.String(s.bucket),
		Key:    awsv2.String(storedKey),
	}, func(opts *s3.PresignOptions) {
		opts.Expires = 24 * time.Hour
	})
	if err != nil {
		return "/api/files/" + thumbHashFromKey(storedKey) + "/thumb"
	}
	return out.URL
}
