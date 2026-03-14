package repository

import (
	"nonza/backend/internal/models"

	"github.com/google/uuid"
)

type Invites interface {
	Create(invite *models.Invite) error
	GetByToken(token string) (*models.Invite, error)
	Delete(id uuid.UUID) error
}
