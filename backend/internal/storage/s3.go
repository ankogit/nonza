package storage

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type S3Config struct {
	Endpoint      string
	AccessKey     string
	SecretKey     string
	UseSSL        bool
	BucketName    string
	PublicBaseURL string
	Region        string
}

type s3Storage struct {
	client        *minio.Client
	bucketName    string
	publicBaseURL string
}

func NewS3Storage(cfg S3Config) (ObjectStorage, error) {
	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
		Region: cfg.Region,
	})
	if err != nil {
		return nil, err
	}

	if cfg.BucketName == "" {
		return nil, fmt.Errorf("s3 bucket name is empty")
	}
	ctx := context.Background()
	exists, err := client.BucketExists(ctx, cfg.BucketName)
	if err != nil {
		return nil, fmt.Errorf("s3 bucket check: %w", err)
	}
	if !exists {
		opts := minio.MakeBucketOptions{Region: cfg.Region}
		if opts.Region == "" {
			opts.Region = "us-east-1"
		}
		if err := client.MakeBucket(ctx, cfg.BucketName, opts); err != nil {
			return nil, fmt.Errorf("s3 create bucket %q: %w", cfg.BucketName, err)
		}
	}

	return &s3Storage{
		client:        client,
		bucketName:    cfg.BucketName,
		publicBaseURL: strings.TrimSuffix(cfg.PublicBaseURL, "/"),
	}, nil
}

func (s *s3Storage) PutFile(ctx context.Context, objectKey string, localPath string, contentType string) (int64, error) {
	stat, err := os.Stat(localPath)
	if err != nil {
		return 0, err
	}

	reader, err := os.Open(localPath) // #nosec G304 -- localPath is a local server path (not user-controlled)
	if err != nil {
		return 0, err
	}
	defer func() { _ = reader.Close() }()

	_, err = s.client.PutObject(ctx, s.bucketName, objectKey, reader, stat.Size(), minio.PutObjectOptions{
		ContentType:  contentType,
		CacheControl: "public,max-age=31536000,immutable",
	})
	if err != nil {
		return 0, err
	}

	return stat.Size(), nil
}

func (s *s3Storage) RemoveObject(ctx context.Context, objectKey string) error {
	key := strings.TrimPrefix(filepath.ToSlash(objectKey), "/")
	return s.client.RemoveObject(ctx, s.bucketName, key, minio.RemoveObjectOptions{})
}

func (s *s3Storage) PublicURL(objectKey string) string {
	key := strings.TrimPrefix(filepath.ToSlash(objectKey), "/")
	if s.publicBaseURL != "" {
		return fmt.Sprintf("%s/%s", s.publicBaseURL, key)
	}
	return fmt.Sprintf("/%s", key)
}

func (s *s3Storage) Bucket() string {
	return s.bucketName
}
