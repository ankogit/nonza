package files

import (
	"context"
	"nonza/backend/internal/models"

	"github.com/google/uuid"
)

type Files interface {
	CreateProcessedSoundFile(ctx context.Context, params CreateProcessedSoundFileParams) (*models.StoredFile, error)
	GetByID(id uuid.UUID) (*models.StoredFile, error)
	GetPublicURL(file *models.StoredFile) string
	Delete(ctx context.Context, id uuid.UUID) error
}

type CreateProcessedSoundFileParams struct {
	OrganizationID uuid.UUID
	SoundID        uuid.UUID
	Version        int
	InputPath      string
	StartMs        int
	EndMs          int
	Volume         int
	Speed          int
	// ClientProcessed: вход уже обрезан и с нужной громкостью/скоростью (WAV) — только transcode в Opus.
	ClientProcessed bool
	CreatedByUserID *string
}

