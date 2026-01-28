package meeting_documents

import (
	"nonza/backend/internal/models"

	"github.com/google/uuid"
)

type MeetingDocuments interface {
	Create(roomID uuid.UUID, title, content string, createdBy *string) (*models.MeetingDocument, error)
	GetByRoomID(roomID uuid.UUID) (*models.MeetingDocument, error)
	Update(roomID uuid.UUID, title, content string) (*models.MeetingDocument, error)
	IncrementVersion(roomID uuid.UUID) error
}
