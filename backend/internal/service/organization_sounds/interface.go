package organization_sounds

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

type OrganizationSounds interface {
	ListForUser(orgID uuid.UUID, userID string) ([]OrganizationSoundDTO, error)
	UpsertWithFile(ctx context.Context, params UpsertWithFileParams) (*OrganizationSoundDTO, error)
	Delete(ctx context.Context, orgID uuid.UUID, soundID uuid.UUID, userID string) error
}

type OrganizationSoundDTO struct {
	ID          string
	Emoji       string
	Title       string
	AudioURL    string
	Version     int
	LoopEnabled bool
	GateEnabled bool
	Volume      int
	Speed       int
}

type UpsertWithFileParams struct {
	OrgID           uuid.UUID
	UserID          string
	Emoji           string
	Title           string
	StartMs         int
	EndMs           int
	LoopEnabled     bool
	GateEnabled     bool
	Volume          int
	Speed           int
	InputPath       string
	ClientProcessed bool
}

var (
	ErrUnauthorized  = errors.New("unauthorized")
	ErrForbidden     = errors.New("forbidden")
	ErrSoundNotFound = errors.New("sound not found")
)

