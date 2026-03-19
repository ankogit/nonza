package models

import (
	"time"

	"github.com/google/uuid"
)

type RoomType string

const (
	RoomTypeConferenceHall RoomType = "conference_hall"
	RoomTypeRoundTable     RoomType = "round_table"
	RoomTypeTableCircle   RoomType = "table_circle"
	RoomTypeMusicLesson   RoomType = "music_lesson"
	RoomTypeStreaming     RoomType = "streaming"
)

type Room struct {
	ID                uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	OrganizationID    uuid.UUID `gorm:"type:uuid;not null;index"`
	Name              string    `gorm:"not null"`
	LiveKitRoomNameCol string `gorm:"column:live_kit_room_name;not null"`
	Slug              *string   `gorm:"type:varchar(255);unique"`
	ShortCode         *string   `gorm:"type:varchar(12);unique;index"`
	RoomType          RoomType  `gorm:"type:varchar(50);not null;default:'conference_hall'"`
	IsTemporary       bool      `gorm:"default:true"`
	ExpiresAt *time.Time
	Settings  JSONB  `gorm:"type:jsonb"`
	CreatedAt       time.Time
	UpdatedAt       time.Time

	RoomGroupID   *uuid.UUID `gorm:"type:uuid;index"`
	Position      int        `gorm:"not null;default:0"`
	RoomGroup     *RoomGroup  `gorm:"foreignKey:RoomGroupID"`
	Organization  Organization `gorm:"foreignKey:OrganizationID"`
}

func (r *Room) LiveKitRoomName() string {
	if r.LiveKitRoomNameCol != "" {
		return r.LiveKitRoomNameCol
	}
	return "room-" + r.ID.String()
}
