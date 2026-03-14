package repository

import (
	"nonza/backend/internal/models"

	"github.com/google/uuid"
)

type RoomGroups interface {
	Create(group *models.RoomGroup) error
	GetByID(id uuid.UUID) (*models.RoomGroup, error)
	GetByOrganizationID(orgID uuid.UUID) ([]models.RoomGroup, error)
	Update(group *models.RoomGroup) error
	Delete(id uuid.UUID) error
}
