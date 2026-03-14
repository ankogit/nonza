package room_groups

import (
	"nonza/backend/internal/models"

	"github.com/google/uuid"
)

type RoomGroups interface {
	Create(orgID uuid.UUID, name string, position int) (*models.RoomGroup, error)
	GetByID(id uuid.UUID) (*models.RoomGroup, error)
	GetByOrganizationID(orgID uuid.UUID) ([]models.RoomGroup, error)
	Update(id uuid.UUID, orgID uuid.UUID, name *string, position *int) (*models.RoomGroup, error)
	Delete(id uuid.UUID, orgID uuid.UUID) error
}
