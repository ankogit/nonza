package repository

import (
	"nonza/backend/internal/models"

	"github.com/google/uuid"
)

type MeetingDocuments interface {
	Create(doc *models.MeetingDocument) error
	GetByRoomID(roomID uuid.UUID) (*models.MeetingDocument, error)
	Update(doc *models.MeetingDocument) error
	IncrementVersion(roomID uuid.UUID) error
}
