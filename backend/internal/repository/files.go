package repository

import (
	"nonza/backend/internal/models"

	"github.com/google/uuid"
)

type Files interface {
	Create(file *models.StoredFile) error
	GetByID(id uuid.UUID) (*models.StoredFile, error)
	Delete(id uuid.UUID) error
}

