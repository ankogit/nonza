package postgresDB

import (
	"nonza/backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type InvitesRepository struct {
	db *gorm.DB
}

func NewInvitesRepository(db *gorm.DB) *InvitesRepository {
	return &InvitesRepository{db: db}
}

func (r *InvitesRepository) Create(invite *models.Invite) error {
	return r.db.Create(invite).Error
}

func (r *InvitesRepository) GetByToken(token string) (*models.Invite, error) {
	var inv models.Invite
	err := r.db.Preload("Organization").Where("token = ?", token).First(&inv).Error
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (r *InvitesRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Invite{}, "id = ?", id).Error
}
