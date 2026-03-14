package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Email        string    `gorm:"type:varchar(255);uniqueIndex;not null"`
	Name         string    `gorm:"type:varchar(255)"`
	Color        *string   `gorm:"type:varchar(7)"`
	PasswordHash string    `gorm:"type:varchar(255);not null"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}
