package repository

import (
	"nonza/backend/internal/models"

	"github.com/google/uuid"
)

type Organizations interface {
	Create(org *models.Organization) error
	GetByID(id uuid.UUID) (*models.Organization, error)
	Update(org *models.Organization) error
	Delete(id uuid.UUID) error
}
