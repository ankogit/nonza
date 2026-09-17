package models

import (
	"time"

	"github.com/google/uuid"
)

type OAuthAuthorizationCode struct {
	ID                    uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Code                  string     `gorm:"type:varchar(128);uniqueIndex;not null"`
	ClientID              string     `gorm:"type:varchar(64);not null;index"`
	UserID                uuid.UUID  `gorm:"type:uuid;not null;index"`
	RedirectURI           string     `gorm:"type:text;not null"`
	Scope                 string     `gorm:"type:text;not null"`
	CodeChallenge         string     `gorm:"type:varchar(128);not null"`
	CodeChallengeMethod   string     `gorm:"type:varchar(16);not null;default:'S256'"`
	ExpiresAt             time.Time  `gorm:"not null;index"`
	UsedAt                *time.Time `gorm:"index"`
	CreatedAt             time.Time
}
