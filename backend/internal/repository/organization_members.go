package repository

import (
	"nonza/backend/internal/models"

	"github.com/google/uuid"
)

type OrganizationMembers interface {
	Add(orgID uuid.UUID, userID string, role string, color *string) error
	Exists(orgID uuid.UUID, userID string) (bool, error)
	GetByOrgAndUser(orgID uuid.UUID, userID string) (*models.OrganizationMember, error)
	ListByOrganizationID(orgID uuid.UUID) ([]*models.OrganizationMember, error)
	UpdateRole(orgID uuid.UUID, userID string, role string) error
	UpdateColor(orgID uuid.UUID, userID string, color *string) error
	Remove(orgID uuid.UUID, userID string) error
}
