package postgresDB

import (
	"nonza/backend/internal/models"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type RoomsRepository struct {
	db *gorm.DB
}

func NewRoomsRepository(db *gorm.DB) *RoomsRepository {
	return &RoomsRepository{db: db}
}

func (r *RoomsRepository) Create(room *models.Room) error {
	return r.db.Create(room).Error
}

func (r *RoomsRepository) GetByID(id uuid.UUID) (*models.Room, error) {
	var room models.Room
	err := r.db.Where("id = ?", id).First(&room).Error
	if err != nil {
		return nil, err
	}
	return &room, nil
}

func (r *RoomsRepository) GetByShortCode(shortCode string) (*models.Room, error) {
	var room models.Room
	err := r.db.Where("short_code = ?", shortCode).First(&room).Error
	if err != nil {
		return nil, err
	}
	return &room, nil
}

func (r *RoomsRepository) GetBySlug(slug string) (*models.Room, error) {
	var room models.Room
	err := r.db.Where("slug = ?", slug).First(&room).Error
	if err != nil {
		return nil, err
	}
	return &room, nil
}

func (r *RoomsRepository) GetByOrganizationID(orgID uuid.UUID) ([]models.Room, error) {
	var rooms []models.Room
	err := r.db.Where("organization_id = ?", orgID).Find(&rooms).Error
	return rooms, err
}

func (r *RoomsRepository) Update(room *models.Room) error {
	return r.db.Save(room).Error
}

func (r *RoomsRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Room{}, "id = ?", id).Error
}

func (r *RoomsRepository) DeleteExpired() error {
	now := time.Now()
	return r.db.Where("is_temporary = ? AND expires_at < ?", true, now).Delete(&models.Room{}).Error
}

// GetExpired returns list of expired rooms (not deleted, just expired)
func (r *RoomsRepository) GetExpired() ([]models.Room, error) {
	var rooms []models.Room
	now := time.Now()
	err := r.db.Where("expires_at IS NOT NULL AND expires_at < ?", now).Find(&rooms).Error
	return rooms, err
}
