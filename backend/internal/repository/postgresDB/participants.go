package postgresDB

import (
	"nonza/backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ParticipantsRepository struct {
	db *gorm.DB
}

func NewParticipantsRepository(db *gorm.DB) *ParticipantsRepository {
	return &ParticipantsRepository{db: db}
}

func (r *ParticipantsRepository) Create(participant *models.Participant) error {
	return r.db.Create(participant).Error
}

func (r *ParticipantsRepository) GetByID(id uuid.UUID) (*models.Participant, error) {
	var participant models.Participant
	err := r.db.Where("id = ?", id).First(&participant).Error
	if err != nil {
		return nil, err
	}
	return &participant, nil
}

func (r *ParticipantsRepository) GetByRoomID(roomID uuid.UUID) ([]models.Participant, error) {
	var participants []models.Participant
	err := r.db.Where("room_id = ? AND left_at IS NULL", roomID).Find(&participants).Error
	return participants, err
}

func (r *ParticipantsRepository) Update(participant *models.Participant) error {
	return r.db.Save(participant).Error
}

func (r *ParticipantsRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Participant{}, "id = ?", id).Error
}
