package invites

import (
	"nonza/backend/internal/models"
	"time"

	"github.com/google/uuid"
)

type Invites interface {
	Create(orgID uuid.UUID, inviterID string, role string, expiresIn time.Duration) (*models.Invite, error)
	GetByToken(token string) (*models.Invite, error)
	Accept(token string, userID string, color *string) error
}
