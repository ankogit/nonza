package rooms

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"nonza/backend/internal/models"
	"nonza/backend/internal/repository"
	"nonza/backend/pkg/room"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func bucketKey(roomGroupID *uuid.UUID) string {
	if roomGroupID == nil {
		return ""
	}
	return roomGroupID.String()
}

const e2eeKeySize = 32

type roomsService struct {
	repo    repository.Rooms
	orgRepo repository.Organizations
}

func (s *roomsService) Create(orgID uuid.UUID, name string, roomType models.RoomType, isTemporary bool, expiresIn *time.Duration, e2eeEnabled bool, roomGroupID *uuid.UUID, allowAnonymousJoin bool, password *string, createdByUserID *string) (*models.Room, error) {
	if _, err := s.orgRepo.GetByID(orgID); err != nil {
		return nil, fmt.Errorf("organization not found: %w", err)
	}

	shortCode := room.GenerateShortCode()

	existingRoom, err := s.repo.GetByShortCode(shortCode)
	for err == nil && existingRoom != nil {
		shortCode = room.GenerateShortCode()
		existingRoom, err = s.repo.GetByShortCode(shortCode)
	}

	var expiresAt *time.Time
	if isTemporary && expiresIn != nil {
		exp := time.Now().Add(*expiresIn)
		expiresAt = &exp
	}

	settings := make(models.JSONB)
	if e2eeEnabled {
		keyBytes := make([]byte, e2eeKeySize)
		if _, err := rand.Read(keyBytes); err != nil {
			return nil, fmt.Errorf("generate E2EE key: %w", err)
		}
		settings["e2ee_enabled"] = true
		settings["encryption_key"] = base64.StdEncoding.EncodeToString(keyBytes)
	}
	if allowAnonymousJoin {
		settings["allow_anonymous_join"] = true
	}
	if allowAnonymousJoin && password != nil {
		if trimmed := strings.TrimSpace(*password); trimmed != "" {
			hash, err := bcrypt.GenerateFromPassword([]byte(trimmed), bcrypt.DefaultCost)
			if err != nil {
				return nil, fmt.Errorf("generate room password hash: %w", err)
			}
			settings["room_password_hash"] = string(hash)
		}
	}
	if createdByUserID != nil && *createdByUserID != "" {
		settings["created_by_user_id"] = *createdByUserID
		if roomType == models.RoomTypeConferenceHall || roomType == models.RoomTypeTableCircle {
			settings["conference_hall_leader_id"] = uuid.New().String()
		}
	}

	position, err := s.repo.GetMaxPosition(orgID, roomGroupID)
	if err != nil {
		return nil, fmt.Errorf("get max position: %w", err)
	}

	newRoom := &models.Room{
		ID:              uuid.New(),
		OrganizationID:  orgID,
		Name:            name,
		ShortCode:       &shortCode,
		RoomType:        roomType,
		IsTemporary:     isTemporary,
		ExpiresAt:       expiresAt,
		Settings:        settings,
		RoomGroupID:     roomGroupID,
		Position:        position,
	}
	newRoom.LiveKitRoomNameCol = "room-" + newRoom.ID.String()

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

func (s *roomsService) UpdateOrder(orgID uuid.UUID, roomIDs []uuid.UUID) error {
	if len(roomIDs) == 0 {
		return nil
	}
	roomByID := make(map[uuid.UUID]*models.Room)
	for _, id := range roomIDs {
		room, err := s.repo.GetByID(id)
		if err != nil || room == nil || room.OrganizationID != orgID {
			return fmt.Errorf("room %s not found or wrong org", id)
		}
		roomByID[id] = room
	}
	idxByBucket := make(map[string]int)
	for _, id := range roomIDs {
		room := roomByID[id]
		k := bucketKey(room.RoomGroupID)
		pos := idxByBucket[k]
		idxByBucket[k] = pos + 1
		if err := s.repo.UpdatePosition(room.ID, pos); err != nil {
			return fmt.Errorf("update position for room %s: %w", id, err)
		}
	}
	return nil
}
