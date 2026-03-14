package organizations

import (
	"errors"
	"regexp"
	orgDto "nonza/backend/internal/dto/organizations"
	"nonza/backend/internal/models"
	"nonza/backend/internal/pkg/orgroles"
	"nonza/backend/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var hexColorRegex = regexp.MustCompile(`^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$`)

func validateMemberColor(c *string) bool {
	if c == nil || *c == "" {
		return true
	}
	return hexColorRegex.MatchString(*c)
}

var (
	ErrForbidden        = errors.New("forbidden")
	ErrCannotChangeOwner = errors.New("cannot change owner role")
	ErrCannotRemoveOwner = errors.New("cannot remove owner")
)

type organizationsService struct {
	repo    repository.Organizations
	members repository.OrganizationMembers
	users   repository.Users
}

func (s *organizationsService) Create(name, description string, ownerID *string) (*models.Organization, error) {
	org := &models.Organization{
		Name:        name,
		Description: description,
		Settings:    make(models.JSONB),
		OwnerID:     ownerID,
	}

	if err := s.repo.Create(org); err != nil {
		return nil, err
	}
	if ownerID != nil && *ownerID != "" {
		if err := s.members.Add(org.ID, *ownerID, orgroles.RoleOwner, nil); err != nil {
			return nil, err
		}
	}
	return org, nil
}

func (s *organizationsService) GetByID(id uuid.UUID) (*models.Organization, error) {
	return s.repo.GetByID(id)
}

func (s *organizationsService) List(userID *string) ([]*models.Organization, error) {
	if userID != nil && *userID != "" {
		return s.repo.ListByUserID(*userID)
	}
	return s.repo.List()
}

func (s *organizationsService) Update(id uuid.UUID, name, description string, callerUserID string) (*models.Organization, error) {
	ok, err := s.UserHasPermission(id, callerUserID, orgroles.PermissionManageOrg)
	if err != nil || !ok {
		return nil, ErrForbidden
	}
	org, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}

	org.Name = name
	org.Description = description

	if err := s.repo.Update(org); err != nil {
		return nil, err
	}

	return org, nil
}

func (s *organizationsService) Delete(id uuid.UUID, callerUserID string) error {
	ok, err := s.UserHasPermission(id, callerUserID, orgroles.PermissionManageOrg)
	if err != nil || !ok {
		return ErrForbidden
	}
	return s.repo.Delete(id)
}

func (s *organizationsService) GetMemberRole(orgID uuid.UUID, userID string) (string, error) {
	if userID == "" {
		return "", nil
	}
	org, err := s.repo.GetByID(orgID)
	if err != nil {
		return "", err
	}
	if org.OwnerID != nil && *org.OwnerID == userID {
		return orgroles.RoleOwner, nil
	}
	members, err := s.members.ListByOrganizationID(orgID)
	if err != nil {
		return "", err
	}
	for _, m := range members {
		if m.UserID == userID {
			if m.Role == "" {
				return orgroles.RoleMember, nil
			}
			return m.Role, nil
		}
	}
	return "", nil
}

func (s *organizationsService) GetMemberColor(orgID uuid.UUID, userID string) (*string, error) {
	if userID == "" {
		return nil, nil
	}
	m, err := s.members.GetByOrgAndUser(orgID, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return m.Color, nil
}

func (s *organizationsService) UserHasPermission(orgID uuid.UUID, userID string, permission string) (bool, error) {
	role, err := s.GetMemberRole(orgID, userID)
	if err != nil || role == "" {
		return false, err
	}
	return orgroles.RoleHasPermission(role, permission), nil
}

func (s *organizationsService) UserCanAccess(orgID uuid.UUID, userID string) (bool, error) {
	if userID == "" {
		return false, nil
	}
	org, err := s.repo.GetByID(orgID)
	if err != nil {
		return false, err
	}
	if org.OwnerID != nil && *org.OwnerID == userID {
		return true, nil
	}
	return s.members.Exists(orgID, userID)
}

func (s *organizationsService) GetMembers(orgID uuid.UUID, callerUserID string) ([]orgDto.OrganizationMemberResponse, error) {
	ok, err := s.UserCanAccess(orgID, callerUserID)
	if err != nil || !ok {
		return nil, err
	}
	org, err := s.repo.GetByID(orgID)
	if err != nil {
		return nil, err
	}
	var result []orgDto.OrganizationMemberResponse
	seen := make(map[string]bool)
	if org.OwnerID != nil && *org.OwnerID != "" {
		name, email := s.lookupUserNameAndEmail(*org.OwnerID)
		ownerColor, _ := s.GetMemberColor(orgID, *org.OwnerID)
		result = append(result, orgDto.OrganizationMemberResponse{UserID: *org.OwnerID, Role: "owner", Email: email, Name: name, Color: ownerColor})
		seen[*org.OwnerID] = true
	}
	members, err := s.members.ListByOrganizationID(orgID)
	if err != nil {
		return nil, err
	}
	for _, m := range members {
		if !seen[m.UserID] {
			seen[m.UserID] = true
			role := m.Role
			if role == "" {
				role = "member"
			}
			userName, email := s.lookupUserNameAndEmail(m.UserID)
			result = append(result, orgDto.OrganizationMemberResponse{UserID: m.UserID, Role: role, Email: email, Name: userName, Color: m.Color})
		}
	}
	return result, nil
}

func (s *organizationsService) GetMember(orgID uuid.UUID, userID string) (*orgDto.OrganizationMemberResponse, error) {
	if userID == "" {
		return nil, nil
	}
	org, err := s.repo.GetByID(orgID)
	if err != nil {
		return nil, err
	}
	name, email := s.lookupUserNameAndEmail(userID)
	if org.OwnerID != nil && *org.OwnerID == userID {
		color, _ := s.GetMemberColor(orgID, userID)
		return &orgDto.OrganizationMemberResponse{UserID: userID, Role: orgroles.RoleOwner, Email: email, Name: name, Color: color}, nil
	}
	m, err := s.members.GetByOrgAndUser(orgID, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	role := m.Role
	if role == "" {
		role = orgroles.RoleMember
	}
	return &orgDto.OrganizationMemberResponse{UserID: m.UserID, Role: role, Email: email, Name: name, Color: m.Color}, nil
}

func (s *organizationsService) UpdateMemberRole(orgID uuid.UUID, targetUserID, newRole, callerUserID string) error {
	if !orgroles.ValidRole(newRole) {
		return errors.New("invalid role")
	}
	callerRole, err := s.GetMemberRole(orgID, callerUserID)
	if err != nil {
		return err
	}
	assignable := orgroles.AssignableRoles(callerRole)
	if len(assignable) == 0 {
		return ErrForbidden
	}
	allowed := false
	for _, r := range assignable {
		if r == newRole {
			allowed = true
			break
		}
	}
	if !allowed {
		return ErrForbidden
	}
	org, err := s.repo.GetByID(orgID)
	if err != nil {
		return err
	}
	if org.OwnerID != nil && *org.OwnerID == targetUserID {
		return ErrCannotChangeOwner
	}
	exists, err := s.members.Exists(orgID, targetUserID)
	if err != nil {
		return err
	}
	if !exists {
		return errors.New("user is not a member")
	}
	return s.members.UpdateRole(orgID, targetUserID, newRole)
}

var ErrInvalidColor = errors.New("invalid color format")

func (s *organizationsService) UpdateMemberColor(orgID uuid.UUID, userID string, color *string) error {
	if !validateMemberColor(color) {
		return ErrInvalidColor
	}
	exists, err := s.members.Exists(orgID, userID)
	if err != nil {
		return err
	}
	if !exists {
		org, err := s.repo.GetByID(orgID)
		if err != nil {
			return err
		}
		if org.OwnerID == nil || *org.OwnerID != userID {
			return errors.New("user is not a member")
		}
		if err := s.members.Add(orgID, userID, orgroles.RoleOwner, color); err != nil {
			return err
		}
		return nil
	}
	return s.members.UpdateColor(orgID, userID, color)
}

func (s *organizationsService) RemoveMember(orgID uuid.UUID, targetUserID, callerUserID string) error {
	org, err := s.repo.GetByID(orgID)
	if err != nil {
		return err
	}
	if targetUserID == callerUserID {
		if org.OwnerID != nil && *org.OwnerID == callerUserID {
			return ErrCannotRemoveOwner
		}
		exists, err := s.members.Exists(orgID, callerUserID)
		if err != nil || !exists {
			return err
		}
		return s.members.Remove(orgID, callerUserID)
	}
	callerRole, err := s.GetMemberRole(orgID, callerUserID)
	if err != nil {
		return err
	}
	if !orgroles.RoleHasPermission(callerRole, orgroles.PermissionManageMembers) {
		return ErrForbidden
	}
	if org.OwnerID != nil && *org.OwnerID == targetUserID {
		return ErrCannotRemoveOwner
	}
	exists, err := s.members.Exists(orgID, targetUserID)
	if err != nil {
		return err
	}
	if !exists {
		return errors.New("user is not a member")
	}
	return s.members.Remove(orgID, targetUserID)
}

func (s *organizationsService) lookupUserNameAndEmail(userID string) (name, email string) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return "", ""
	}
	u, err := s.users.GetByID(id)
	if err != nil || u == nil {
		return "", ""
	}
	return u.Name, u.Email
}
