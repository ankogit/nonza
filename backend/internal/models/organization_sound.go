package models

import (
	"time"

	"github.com/google/uuid"
)

// OrganizationSound represents an organization-wide sound bound to an emoji.
// The same (organization_id, emoji) pair must be unique; Version is incremented on each update.
type OrganizationSound struct {
	ID uuid.UUID `gorm:"type:uuid;primary_key"`

	OrganizationID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_org_sound_emoji"`
	Emoji          string    `gorm:"type:varchar(32);not null;uniqueIndex:idx_org_sound_emoji"`

	Title string `gorm:"type:varchar(255);not null;default:''"`

	FileID uuid.UUID `gorm:"type:uuid;not null"`

	Version int `gorm:"not null;default:1"`

	LoopEnabled bool `gorm:"not null;default:false"`
	GateEnabled bool `gorm:"not null;default:false"`
	Volume      int  `gorm:"not null;default:100"`
	Speed       int  `gorm:"not null;default:100"`

	CreatedByUserID *string `gorm:"type:varchar(255)"`

	CreatedAt time.Time
	UpdatedAt time.Time
}

