package organizations

import (
	"nonza/backend/internal/models"

	"github.com/google/uuid"
)

type Organizations interface {
	Create(name, description string) (*models.Organization, error)
	GetByID(id uuid.UUID) (*models.Organization, error)
	Update(id uuid.UUID, name, description string) (*models.Organization, error)
	Delete(id uuid.UUID) error
}
