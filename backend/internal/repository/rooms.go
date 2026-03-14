package repository

import (
	"nonza/backend/internal/models"

	"github.com/google/uuid"
)

type Rooms interface {
	Create(room *models.Room) error
	GetByID(id uuid.UUID) (*models.Room, error)
	GetByShortCode(shortCode string) (*models.Room, error)
	GetBySlug(slug string) (*models.Room, error)
	GetByOrganizationID(orgID uuid.UUID) ([]models.Room, error)
	GetMaxPosition(orgID uuid.UUID, roomGroupID *uuid.UUID) (int, error)
	Update(room *models.Room) error
	Delete(id uuid.UUID) error
	DeleteExpired() error
	GetExpired() ([]models.Room, error)
	UnsetGroupIDForGroup(groupID uuid.UUID) error
	UpdatePosition(roomID uuid.UUID, position int) error
}
