package room_groups

import (
	"fmt"
	"nonza/backend/internal/models"
	"nonza/backend/internal/repository"

	"github.com/google/uuid"
)

type roomGroupsService struct {
	repo     repository.RoomGroups
	roomsRepo repository.Rooms
	orgRepo  repository.Organizations
}

func NewRoomGroupsService(repo repository.RoomGroups, roomsRepo repository.Rooms, orgRepo repository.Organizations) RoomGroups {
	return &roomGroupsService{repo: repo, roomsRepo: roomsRepo, orgRepo: orgRepo}
}

func (s *roomGroupsService) Create(orgID uuid.UUID, name string, position int) (*models.RoomGroup, error) {
	if _, err := s.orgRepo.GetByID(orgID); err != nil {
		return nil, fmt.Errorf("organization not found: %w", err)
	}
	g := &models.RoomGroup{
		OrganizationID: orgID,
		Name:           name,
		Position:       position,
	}
	if err := s.repo.Create(g); err != nil {
		return nil, err
	}
	return g, nil
}

func (s *roomGroupsService) GetByID(id uuid.UUID) (*models.RoomGroup, error) {
	return s.repo.GetByID(id)
}

func (s *roomGroupsService) GetByOrganizationID(orgID uuid.UUID) ([]models.RoomGroup, error) {
	return s.repo.GetByOrganizationID(orgID)
}

func (s *roomGroupsService) Update(id uuid.UUID, orgID uuid.UUID, name *string, position *int) (*models.RoomGroup, error) {
	group, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if group.OrganizationID != orgID {
		return nil, fmt.Errorf("room group not found")
	}
	if name != nil {
		group.Name = *name
	}
	if position != nil {
		group.Position = *position
	}
	if err := s.repo.Update(group); err != nil {
		return nil, err
	}
	return group, nil
}

func (s *roomGroupsService) Delete(id uuid.UUID, orgID uuid.UUID) error {
	group, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}
	if group.OrganizationID != orgID {
		return fmt.Errorf("room group not found")
	}
	if err := s.roomsRepo.UnsetGroupIDForGroup(id); err != nil {
		return err
	}
	return s.repo.Delete(id)
}
