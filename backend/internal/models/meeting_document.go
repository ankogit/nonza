package models

import (
	"time"

	"github.com/google/uuid"
)

type MeetingDocument struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	RoomID    uuid.UUID `gorm:"type:uuid;not null;index"`
	Title     string    `gorm:"not null"`
	Content   string    `gorm:"type:text"`
	Version   int       `gorm:"default:0"`
	CreatedBy *string   `gorm:"type:varchar(255)"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Room Room `gorm:"foreignKey:RoomID"`
}
