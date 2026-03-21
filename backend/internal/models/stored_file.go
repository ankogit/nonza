package models

import (
	"time"

	"github.com/google/uuid"
)

type StoredFile struct {
	ID uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`

	Provider  string `gorm:"type:varchar(32);not null"`
	Bucket    string `gorm:"type:varchar(255);not null"`
	ObjectKey string `gorm:"type:text;not null;uniqueIndex"`

	MimeType string `gorm:"type:varchar(255);not null"`
	SizeBytes int64 `gorm:"not null;default:0"`

	CreatedByUserID *string `gorm:"type:varchar(255)"`

	CreatedAt time.Time
	UpdatedAt time.Time
}

