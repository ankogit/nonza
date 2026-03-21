package organization_sounds

import (
	"context"
	"errors"
	"fmt"
	"nonza/backend/internal/models"
	"nonza/backend/internal/pkg/orgroles"
	"nonza/backend/internal/repository"
	"nonza/backend/internal/service/files"
	"nonza/backend/internal/service/organizations"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type organizationSoundsService struct {
	repo  repository.OrganizationSounds
	orgs  organizations.Organizations
	files files.Files
}

func NewOrganizationSoundsService(
	repo repository.OrganizationSounds,
	orgs organizations.Organizations,
	filesSvc files.Files,
) *organizationSoundsService {
	return &organizationSoundsService{
		repo:  repo,
		orgs:  orgs,
		files: filesSvc,
	}
}

func (s *organizationSoundsService) ListForUser(orgID uuid.UUID, userID string) ([]OrganizationSoundDTO, error) {
	if userID == "" {
		return nil, ErrUnauthorized
	}

	canAccess, err := s.orgs.UserCanAccess(orgID, userID)
	if err != nil {
		return nil, err
	}
	if !canAccess {
		return nil, ErrForbidden
	}

	rows, err := s.repo.ListByOrganizationID(orgID)
	if err != nil {
		return nil, err
	}

	resp := make([]OrganizationSoundDTO, 0, len(rows))
	for _, row := range rows {
		file, err := s.files.GetByID(row.FileID)
		if err != nil {
			return nil, err
		}
		resp = append(resp, OrganizationSoundDTO{
			ID:          row.ID.String(),
			Emoji:       row.Emoji,
			Title:       row.Title,
			AudioURL:    s.files.GetPublicURL(file),
			Version:     row.Version,
			LoopEnabled: row.LoopEnabled,
			GateEnabled: row.GateEnabled,
			Volume:      row.Volume,
			Speed:       row.Speed,
		})
	}

	return resp, nil
}

func (s *organizationSoundsService) UpsertWithFile(
	ctx context.Context,
	params UpsertWithFileParams,
) (*OrganizationSoundDTO, error) {
	if params.UserID == "" {
		return nil, ErrUnauthorized
	}

	canAccess, err := s.orgs.UserCanAccess(params.OrgID, params.UserID)
	if err != nil {
		return nil, err
	}
	if !canAccess {
		return nil, ErrForbidden
	}

	role, err := s.orgs.GetMemberRole(params.OrgID, params.UserID)
	if err != nil {
		return nil, err
	}
	if role != orgroles.RoleOwner && role != orgroles.RoleAdmin {
		return nil, ErrForbidden
	}

	existing, err := s.repo.GetByOrganizationIDAndEmoji(params.OrgID, params.Emoji)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	var soundID uuid.UUID
	var version int
	if existing == nil || errors.Is(err, gorm.ErrRecordNotFound) {
		soundID = uuid.New()
		version = 1
	} else {
		soundID = existing.ID
		version = existing.Version + 1
	}

	storedFile, err := s.files.CreateProcessedSoundFile(ctx, files.CreateProcessedSoundFileParams{
		OrganizationID:  params.OrgID,
		SoundID:         soundID,
		Version:         version,
		InputPath:       params.InputPath,
		StartMs:         params.StartMs,
		EndMs:           params.EndMs,
		Volume:          params.Volume,
		Speed:           params.Speed,
		ClientProcessed: params.ClientProcessed,
		CreatedByUserID: &params.UserID,
	})
	if err != nil {
		return nil, fmt.Errorf("process sound file: %w", err)
	}

	sound := &models.OrganizationSound{
		ID:              soundID,
		OrganizationID:  params.OrgID,
		Emoji:           params.Emoji,
		Title:           params.Title,
		FileID:          storedFile.ID,
		Version:         version,
		LoopEnabled:     params.LoopEnabled,
		GateEnabled:     params.GateEnabled,
		Volume:          params.Volume,
		Speed:           params.Speed,
		CreatedByUserID: &params.UserID,
	}
	if err := s.repo.UpsertMetadata(sound); err != nil {
		return nil, fmt.Errorf("save sound metadata: %w", err)
	}

	return &OrganizationSoundDTO{
		ID:          sound.ID.String(),
		Emoji:       sound.Emoji,
		Title:       sound.Title,
		AudioURL:    s.files.GetPublicURL(storedFile),
		Version:     sound.Version,
		LoopEnabled: sound.LoopEnabled,
		GateEnabled: sound.GateEnabled,
		Volume:      sound.Volume,
		Speed:       sound.Speed,
	}, nil
}

func (s *organizationSoundsService) Delete(ctx context.Context, orgID uuid.UUID, soundID uuid.UUID, userID string) error {
	if userID == "" {
		return ErrUnauthorized
	}

	canAccess, err := s.orgs.UserCanAccess(orgID, userID)
	if err != nil {
		return err
	}
	if !canAccess {
		return ErrForbidden
	}

	role, err := s.orgs.GetMemberRole(orgID, userID)
	if err != nil {
		return err
	}
	if role != orgroles.RoleOwner && role != orgroles.RoleAdmin {
		return ErrForbidden
	}

	row, err := s.repo.GetByID(orgID, soundID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrSoundNotFound
		}
		return err
	}

	fileID := row.FileID
	if err := s.repo.DeleteByID(orgID, soundID); err != nil {
		return err
	}
	if err := s.files.Delete(ctx, fileID); err != nil {
		return err
	}
	return nil
}

