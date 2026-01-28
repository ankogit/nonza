package rooms

import (
	"nonza/backend/internal/repository"
)

func NewRoomsService(repo repository.Rooms, orgRepo repository.Organizations) Rooms {
	return &roomsService{
		repo:    repo,
		orgRepo: orgRepo,
	}
}
