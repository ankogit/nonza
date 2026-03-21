package repository

import (
	"nonza/backend/internal/models"

	"github.com/google/uuid"
)

type OrganizationSounds interface {
	ListByOrganizationID(orgID uuid.UUID) ([]*models.OrganizationSound, error)
	GetByOrganizationIDAndEmoji(orgID uuid.UUID, emoji string) (*models.OrganizationSound, error)
	GetByID(orgID uuid.UUID, id uuid.UUID) (*models.OrganizationSound, error)
	DeleteByID(orgID uuid.UUID, id uuid.UUID) error
	UpsertMetadata(sound *models.OrganizationSound) error
}

