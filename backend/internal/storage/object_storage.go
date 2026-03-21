package storage

import "context"

type ObjectStorage interface {
	PutFile(ctx context.Context, objectKey string, localPath string, contentType string) (size int64, err error)
	RemoveObject(ctx context.Context, objectKey string) error
	PublicURL(objectKey string) string
	Bucket() string
}

