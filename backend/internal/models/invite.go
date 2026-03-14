package models

import (
	"time"

	"github.com/google/uuid"
)

type Invite struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Token          string    `gorm:"type:varchar(64);uniqueIndex;not null"`
	OrganizationID uuid.UUID `gorm:"type:uuid;not null;index"`
	InviterID      string    `gorm:"type:varchar(255)"`
	Role           string    `gorm:"type:varchar(50);default:'member'"`
	ExpiresAt      time.Time `gorm:"not null"`
	CreatedAt      time.Time

	Organization Organization `gorm:"foreignKey:OrganizationID"`
}
