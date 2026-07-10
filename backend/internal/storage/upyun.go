package storage

import (
	"fmt"
	"io"
)

// UpyunStorage implements file storage using Upyun CDN.
type UpyunStorage struct {
	bucket   string
	operator string
	password string
	endpoint string
}

// NewUpyunStorage creates a new UpyunStorage.
func NewUpyunStorage(bucket, operator, password, endpoint string) (*UpyunStorage, error) {
	if bucket == "" || operator == "" || password == "" {
		return nil, fmt.Errorf("upyun config incomplete: bucket, operator, and password are required")
	}
	return &UpyunStorage{
		bucket:   bucket,
		operator: operator,
		password: password,
		endpoint: endpoint,
	}, nil
}

// Save uploads a file to Upyun.
func (s *UpyunStorage) Save(filename string, data io.Reader) (string, error) {
	// TODO: implement Upyun SDK upload
	return "", fmt.Errorf("upyun storage not yet implemented")
}

// SaveThumb uploads a thumbnail to Upyun.
func (s *UpyunStorage) SaveThumb(filename string, data io.Reader) (string, error) {
	// TODO: implement Upyun SDK upload
	return "", fmt.Errorf("upyun storage not yet implemented")
}

// Delete removes a file from Upyun.
func (s *UpyunStorage) Delete(filename string) error {
	// TODO: implement Upyun SDK delete
	return fmt.Errorf("upyun storage not yet implemented")
}

// DeleteThumb removes a thumbnail from Upyun.
func (s *UpyunStorage) DeleteThumb(filename string) error {
	// TODO: implement Upyun SDK delete
	return fmt.Errorf("upyun storage not yet implemented")
}
