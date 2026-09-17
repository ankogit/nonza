package models

import (
	"time"

	"github.com/google/uuid"
)

const (
	OAuthClientTypeConfidential = "confidential"
	OAuthClientTypePublic       = "public"
)

type OAuthClient struct {
	ID               uuid.UUID   `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ClientID         string      `gorm:"type:varchar(64);uniqueIndex;not null"`
	ClientSecretHash string      `gorm:"type:varchar(255)"`
	Name             string      `gorm:"type:varchar(255);not null"`
	RedirectURIs     StringSlice `gorm:"type:jsonb;not null"`
	Scopes           StringSlice `gorm:"type:jsonb;not null"`
	ClientType       string      `gorm:"type:varchar(32);not null;default:'confidential'"`
	Trusted          bool        `gorm:"not null;default:false"`
	Active           bool        `gorm:"not null;default:true"`
	// OrganizationID — организация, в которой партнёрский клиент может создавать временные комнаты.
	OrganizationID *uuid.UUID `gorm:"type:uuid;index"`
	CreatedAt      time.Time
	UpdatedAt      time.Time
}
