package models

import (
	"time"

	"github.com/google/uuid"
)

type OrganizationMember struct {
	OrganizationID uuid.UUID `gorm:"type:uuid;primaryKey;uniqueIndex:idx_org_user"`
	UserID         string    `gorm:"type:varchar(255);primaryKey;uniqueIndex:idx_org_user"`
	Role           string    `gorm:"type:varchar(50);default:'member'"`
	Color          *string   `gorm:"type:varchar(7)"`
	CreatedAt      time.Time

	Organization Organization `gorm:"foreignKey:OrganizationID"`
}
