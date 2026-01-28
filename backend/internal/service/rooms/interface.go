package rooms

import (
	"nonza/backend/internal/models"
	"time"

	"github.com/google/uuid"
)

type Rooms interface {
	Create(orgID uuid.UUID, name string, roomType models.RoomType, isTemporary bool, expiresIn *time.Duration) (*models.Room, error)
	GetByID(id uuid.UUID) (*models.Room, error)
	GetByShortCode(shortCode string) (*models.Room, error)
	GetByOrganizationID(orgID uuid.UUID) ([]models.Room, error)
	Update(room *models.Room) error
	Delete(id uuid.UUID) error
	DeleteExpired() error
	GetExpired() ([]models.Room, error)
}
