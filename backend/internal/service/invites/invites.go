package invites

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"time"

	"nonza/backend/internal/models"
	"nonza/backend/internal/repository"

	"github.com/google/uuid"
)

var hexColorRegex = regexp.MustCompile(`^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$`)

func validateColor(c *string) bool {
	if c == nil || *c == "" {
		return true
	}
	return hexColorRegex.MatchString(*c)
}

var (
	ErrInviteExpired = errors.New("invite expired")
	ErrAlreadyMember = errors.New("already a member")
)

type invitesService struct {
	invitesRepo  repository.Invites
	orgMembersRepo repository.OrganizationMembers
	orgsRepo    repository.Organizations
}

func NewInvitesService(
	invitesRepo repository.Invites,
	orgMembersRepo repository.OrganizationMembers,
	orgsRepo repository.Organizations,
) Invites {
	return &invitesService{
		invitesRepo:    invitesRepo,
		orgMembersRepo: orgMembersRepo,
		orgsRepo:       orgsRepo,
	}
}

func token() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (s *invitesService) Create(orgID uuid.UUID, inviterID string, role string, expiresIn time.Duration) (*models.Invite, error) {
	if _, err := s.orgsRepo.GetByID(orgID); err != nil {
		return nil, fmt.Errorf("organization: %w", err)
	}
	tok, err := token()
	if err != nil {
		return nil, err
	}
	expiresAt := time.Now().Add(expiresIn)
	if expiresIn <= 0 {
		expiresAt = time.Now().Add(7 * 24 * time.Hour)
	}
	inv := &models.Invite{
		Token:          tok,
		OrganizationID: orgID,
		InviterID:      inviterID,
		Role:           role,
		ExpiresAt:      expiresAt,
	}
	if err := s.invitesRepo.Create(inv); err != nil {
		return nil, err
	}
	return inv, nil
}

func (s *invitesService) GetByToken(token string) (*models.Invite, error) {
	return s.invitesRepo.GetByToken(token)
}

var ErrInvalidColor = errors.New("invalid color format")

func (s *invitesService) Accept(token string, userID string, color *string) error {
	if userID == "" {
		return errors.New("user_id required")
	}
	if !validateColor(color) {
		return ErrInvalidColor
	}
	inv, err := s.invitesRepo.GetByToken(token)
	if err != nil {
		return err
	}
	if time.Now().After(inv.ExpiresAt) {
		return ErrInviteExpired
	}
	exists, err := s.orgMembersRepo.Exists(inv.OrganizationID, userID)
	if err != nil {
		return err
	}
	if exists {
		return ErrAlreadyMember
	}
	if err := s.orgMembersRepo.Add(inv.OrganizationID, userID, inv.Role, color); err != nil {
		return err
	}
	return s.invitesRepo.Delete(inv.ID)
}
