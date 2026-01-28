package models

import (
	"time"

	"github.com/google/uuid"
)

type DocumentOperation struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	DocumentID     uuid.UUID `gorm:"type:uuid;not null;index"`
	OperationType  string    `gorm:"type:varchar(50);not null"`
	OperationData  JSONB     `gorm:"type:jsonb"`
	AuthorID       *string   `gorm:"type:varchar(255)"`
	SequenceNumber int       `gorm:"not null;index"`
	Timestamp      time.Time `gorm:"not null;index"`

	Document MeetingDocument `gorm:"foreignKey:DocumentID"`
}
