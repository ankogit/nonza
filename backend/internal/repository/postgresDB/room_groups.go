package postgresDB

import (
	"nonza/backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type RoomGroupsRepository struct {
	db *gorm.DB
}

func NewRoomGroupsRepository(db *gorm.DB) *RoomGroupsRepository {
	return &RoomGroupsRepository{db: db}
}

func (r *RoomGroupsRepository) Create(group *models.RoomGroup) error {
	return r.db.Create(group).Error
}

func (r *RoomGroupsRepository) GetByID(id uuid.UUID) (*models.RoomGroup, error) {
	var group models.RoomGroup
	err := r.db.Where("id = ?", id).First(&group).Error
	if err != nil {
		return nil, err
	}
	return &group, nil
}

func (r *RoomGroupsRepository) GetByOrganizationID(orgID uuid.UUID) ([]models.RoomGroup, error) {
	var groups []models.RoomGroup
	err := r.db.Where("organization_id = ?", orgID).Order("position ASC, name ASC").Find(&groups).Error
	return groups, err
}

func (r *RoomGroupsRepository) Update(group *models.RoomGroup) error {
	return r.db.Save(group).Error
}

func (r *RoomGroupsRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.RoomGroup{}, "id = ?", id).Error
}
