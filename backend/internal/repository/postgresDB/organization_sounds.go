package postgresDB

import (
	"log"
	"nonza/backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type OrganizationSoundsRepository struct {
	db *gorm.DB
}

func NewOrganizationSoundsRepository(db *gorm.DB) *OrganizationSoundsRepository {
	return &OrganizationSoundsRepository{db: db}
}

func (r *OrganizationSoundsRepository) ListByOrganizationID(orgID uuid.UUID) ([]*models.OrganizationSound, error) {
	var sounds []*models.OrganizationSound
	if err := r.db.
		Where("organization_id = ?", orgID).
		Order("emoji ASC").
		Find(&sounds).
		Error; err != nil {
		return nil, err
	}
	return sounds, nil
}

func (r *OrganizationSoundsRepository) GetByOrganizationIDAndEmoji(orgID uuid.UUID, emoji string) (*models.OrganizationSound, error) {
	var sound models.OrganizationSound
	result := r.db.
		Where("organization_id = ? AND emoji = ?", orgID, emoji).
		Limit(1).
		Find(&sound)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return &sound, nil
}

func (r *OrganizationSoundsRepository) GetByID(orgID uuid.UUID, id uuid.UUID) (*models.OrganizationSound, error) {
	var sound models.OrganizationSound
	if err := r.db.
		Where("organization_id = ? AND id = ?", orgID, id).
		First(&sound).
		Error; err != nil {
		return nil, err
	}
	return &sound, nil
}

func (r *OrganizationSoundsRepository) DeleteByID(orgID uuid.UUID, id uuid.UUID) error {
	return r.db.
		Where("organization_id = ? AND id = ?", orgID, id).
		Delete(&models.OrganizationSound{}).
		Error
}

func (r *OrganizationSoundsRepository) UpsertMetadata(sound *models.OrganizationSound) error {
	var existing models.OrganizationSound
	result := r.db.
		Where("organization_id = ? AND emoji = ?", sound.OrganizationID, sound.Emoji).
		Limit(1).
		Find(&existing)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		log.Printf("[OrganizationSoundsRepository] Creating sound: org=%s emoji=%s version=%d", sound.OrganizationID, sound.Emoji, sound.Version)
		return r.db.Create(sound).Error
	}

	// Preserve DB primary key (ID) if caller didn't set it.
	if sound.ID == uuid.Nil {
		sound.ID = existing.ID
	}

	sound.CreatedAt = existing.CreatedAt
	sound.UpdatedAt = existing.UpdatedAt

	return r.db.
		Model(&models.OrganizationSound{}).
		Where("id = ?", existing.ID).
		Updates(map[string]interface{}{
			"file_id":      sound.FileID,
			"version":      sound.Version,
			"loop_enabled": sound.LoopEnabled,
			"gate_enabled": sound.GateEnabled,
			"volume":       sound.Volume,
			"speed":        sound.Speed,
			"title":        sound.Title,
		}).
		Error
}

