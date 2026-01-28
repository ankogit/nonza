package models

import (
	"time"

	"github.com/google/uuid"
)

type RoomType string

const (
	RoomTypeConferenceHall RoomType = "conference_hall"
	RoomTypeRoundTable     RoomType = "round_table"
	RoomTypeMusicLesson    RoomType = "music_lesson"
	RoomTypeStreaming      RoomType = "streaming"
)

type Room struct {
	ID              uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	OrganizationID  uuid.UUID `gorm:"type:uuid;not null;index"`
	Name            string    `gorm:"not null"`
	Slug            *string   `gorm:"type:varchar(255);unique"`
	ShortCode       *string   `gorm:"type:varchar(12);unique;index"`
	RoomType        RoomType  `gorm:"type:varchar(50);not null;default:'conference_hall'"`
	IsTemporary     bool      `gorm:"default:true"`
	ExpiresAt       *time.Time
	LiveKitRoomName string `gorm:"type:varchar(255);not null"`
	Settings        JSONB  `gorm:"type:jsonb"`
	CreatedAt       time.Time
	UpdatedAt       time.Time

	Organization Organization `gorm:"foreignKey:OrganizationID"`
}
