package models

import (
	"time"

	"github.com/google/uuid"
)

type RoomGroup struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	OrganizationID uuid.UUID `gorm:"type:uuid;not null;index"`
	Name           string    `gorm:"not null"`
	Position       int       `gorm:"default:0"`
	CreatedAt      time.Time
	UpdatedAt      time.Time

	Organization Organization `gorm:"foreignKey:OrganizationID"`
}
