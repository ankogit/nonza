package models

import (
	"time"

	"github.com/google/uuid"
)

type OAuthRefreshToken struct {
	ID        uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	TokenHash string     `gorm:"type:varchar(64);uniqueIndex;not null"`
	JTI       string     `gorm:"type:varchar(64);uniqueIndex;not null"`
	ClientID  string     `gorm:"type:varchar(64);not null;index"`
	UserID    uuid.UUID  `gorm:"type:uuid;not null;index"`
	Scope     string     `gorm:"type:text;not null"`
	ExpiresAt time.Time  `gorm:"not null;index"`
	RevokedAt *time.Time `gorm:"index"`
	CreatedAt time.Time
}
