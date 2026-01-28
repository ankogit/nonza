package rooms

import (
	"fmt"
	"nonza/backend/internal/models"
	"nonza/backend/internal/repository"
	"nonza/backend/pkg/room"
	"time"

	"github.com/google/uuid"
)

type roomsService struct {
	repo    repository.Rooms
	orgRepo repository.Organizations
}

func (s *roomsService) Create(orgID uuid.UUID, name string, roomType models.RoomType, isTemporary bool, expiresIn *time.Duration) (*models.Room, error) {
	if _, err := s.orgRepo.GetByID(orgID); err != nil {
		return nil, fmt.Errorf("organization not found: %w", err)
	}

	shortCode := room.GenerateShortCode()

	existingRoom, err := s.repo.GetByShortCode(shortCode)
	for err == nil && existingRoom != nil {
		shortCode = room.GenerateShortCode()
		existingRoom, err = s.repo.GetByShortCode(shortCode)
	}

	livekitRoomName := fmt.Sprintf("room-%s", uuid.New().String())

	var expiresAt *time.Time
	if isTemporary && expiresIn != nil {
		exp := time.Now().Add(*expiresIn)
		expiresAt = &exp
	}

	newRoom := &models.Room{
		OrganizationID:  orgID,
		Name:            name,
		ShortCode:       &shortCode,
		RoomType:        roomType,
		IsTemporary:     isTemporary,
		ExpiresAt:       expiresAt,
		LiveKitRoomName: livekitRoomName,
		Settings:        make(models.JSONB),
	}

	if err := s.repo.Create(newRoom); err != nil {
		return nil, err
	}

	return newRoom, nil
}

func (s *roomsService) GetByID(id uuid.UUID) (*models.Room, error) {
	return s.repo.GetByID(id)
}

func (s *roomsService) GetByShortCode(shortCode string) (*models.Room, error) {
	return s.repo.GetByShortCode(shortCode)
}

func (s *roomsService) GetByOrganizationID(orgID uuid.UUID) ([]models.Room, error) {
	return s.repo.GetByOrganizationID(orgID)
}

func (s *roomsService) Update(room *models.Room) error {
	return s.repo.Update(room)
}

func (s *roomsService) Delete(id uuid.UUID) error {
	return s.repo.Delete(id)
}

func (s *roomsService) DeleteExpired() error {
	return s.repo.DeleteExpired()
}

func (s *roomsService) GetExpired() ([]models.Room, error) {
	return s.repo.GetExpired()
}
