package repository

import (
	"nonza/backend/internal/models"

	"github.com/google/uuid"
)

type Participants interface {
	Create(participant *models.Participant) error
	GetByID(id uuid.UUID) (*models.Participant, error)
	GetByRoomID(roomID uuid.UUID) ([]models.Participant, error)
	Update(participant *models.Participant) error
	Delete(id uuid.UUID) error
}
