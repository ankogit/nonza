package repository

import (
	"nonza/backend/internal/models"

	"github.com/google/uuid"
)

type Users interface {
	Create(user *models.User) error
	GetByID(id uuid.UUID) (*models.User, error)
	GetByEmail(email string) (*models.User, error)
	Update(user *models.User) error
}
