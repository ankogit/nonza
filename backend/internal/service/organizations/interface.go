package organizations

import (
	"context"
	orgDto "nonza/backend/internal/dto/organizations"
	"nonza/backend/internal/models"

	"github.com/google/uuid"
)

type Organizations interface {
	Create(name, description string, ownerID *string) (*models.Organization, error)
	GetByID(id uuid.UUID) (*models.Organization, error)
	List(userID *string) ([]*models.Organization, error)
	Update(id uuid.UUID, name, description string, callerUserID string) (*models.Organization, error)
	Delete(ctx context.Context, id uuid.UUID, callerUserID string) error
	UserCanAccess(orgID uuid.UUID, userID string) (bool, error)
	GetMemberRole(orgID uuid.UUID, userID string) (string, error)
	GetMemberColor(orgID uuid.UUID, userID string) (*string, error)
	UserHasPermission(orgID uuid.UUID, userID string, permission string) (bool, error)
	GetMembers(orgID uuid.UUID, callerUserID string) ([]orgDto.OrganizationMemberResponse, error)
	GetMember(orgID uuid.UUID, userID string) (*orgDto.OrganizationMemberResponse, error)
	UpdateMemberRole(orgID uuid.UUID, targetUserID, newRole, callerUserID string) error
	UpdateMemberColor(orgID uuid.UUID, userID string, color *string) error
	RemoveMember(orgID uuid.UUID, targetUserID, callerUserID string) error
}
