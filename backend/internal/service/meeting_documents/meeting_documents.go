package meeting_documents

import (
	"nonza/backend/internal/models"
	"nonza/backend/internal/repository"

	"github.com/google/uuid"
)

type meetingDocumentsService struct {
	repo repository.MeetingDocuments
}

func (s *meetingDocumentsService) Create(roomID uuid.UUID, title, content string, createdBy *string) (*models.MeetingDocument, error) {
	doc := &models.MeetingDocument{
		RoomID:    roomID,
		Title:     title,
		Content:   content,
		Version:   0,
		CreatedBy: createdBy,
	}

	if err := s.repo.Create(doc); err != nil {
		return nil, err
	}

	return doc, nil
}

func (s *meetingDocumentsService) GetByRoomID(roomID uuid.UUID) (*models.MeetingDocument, error) {
	return s.repo.GetByRoomID(roomID)
}

func (s *meetingDocumentsService) Update(roomID uuid.UUID, title, content string) (*models.MeetingDocument, error) {
	doc, err := s.repo.GetByRoomID(roomID)
	if err != nil {
		return nil, err
	}

	doc.Title = title
	doc.Content = content

	if err := s.repo.Update(doc); err != nil {
		return nil, err
	}

	return doc, nil
}

func (s *meetingDocumentsService) IncrementVersion(roomID uuid.UUID) error {
	return s.repo.IncrementVersion(roomID)
}
