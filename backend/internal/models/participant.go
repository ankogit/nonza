package models

import (
	"time"

	"github.com/google/uuid"
)

type ParticipantRole string

const (
	RoleMainSpeaker ParticipantRole = "main_speaker"
	RoleParticipant ParticipantRole = "participant"
	RoleModerator   ParticipantRole = "moderator"
)

type Participant struct {
	ID            uuid.UUID       `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	RoomID        uuid.UUID       `gorm:"type:uuid;not null;index"`
	UserID        *string         `gorm:"type:varchar(255)"`
	AnonymousID   *string         `gorm:"type:varchar(255)"`
	Role          ParticipantRole `gorm:"type:varchar(50);default:'participant'"`
	IsMainSpeaker bool            `gorm:"default:false"`
	Settings      JSONB           `gorm:"type:jsonb"`
	JoinedAt      time.Time
	LeftAt        *time.Time

	Room Room `gorm:"foreignKey:RoomID"`
}
