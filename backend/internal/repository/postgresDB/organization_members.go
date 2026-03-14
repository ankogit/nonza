package postgresDB

import (
	"nonza/backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type OrganizationMembersRepository struct {
	db *gorm.DB
}

func NewOrganizationMembersRepository(db *gorm.DB) *OrganizationMembersRepository {
	return &OrganizationMembersRepository{db: db}
}

func (r *OrganizationMembersRepository) Add(orgID uuid.UUID, userID string, role string, color *string) error {
	var memberColor *string
	if color != nil && *color != "" {
		memberColor = color
	}
	m := &models.OrganizationMember{
		OrganizationID: orgID,
		UserID:         userID,
		Role:           role,
		Color:          memberColor,
	}
	return r.db.Create(m).Error
}

func (r *OrganizationMembersRepository) Exists(orgID uuid.UUID, userID string) (bool, error) {
	var count int64
	err := r.db.Model(&models.OrganizationMember{}).
		Where("organization_id = ? AND LOWER(user_id) = LOWER(?)", orgID, userID).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *OrganizationMembersRepository) GetByOrgAndUser(orgID uuid.UUID, userID string) (*models.OrganizationMember, error) {
	var m models.OrganizationMember
	err := r.db.Where("organization_id = ? AND LOWER(user_id) = LOWER(?)", orgID, userID).First(&m).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *OrganizationMembersRepository) ListByOrganizationID(orgID uuid.UUID) ([]*models.OrganizationMember, error) {
	var list []*models.OrganizationMember
	err := r.db.Where("organization_id = ?", orgID).Order("created_at ASC").Find(&list).Error
	return list, err
}

func (r *OrganizationMembersRepository) UpdateRole(orgID uuid.UUID, userID string, role string) error {
	return r.db.Model(&models.OrganizationMember{}).
		Where("organization_id = ? AND LOWER(user_id) = LOWER(?)", orgID, userID).
		Update("role", role).Error
}

func (r *OrganizationMembersRepository) UpdateColor(orgID uuid.UUID, userID string, color *string) error {
	val := interface{}(color)
	if color != nil && *color == "" {
		val = nil
	}
	return r.db.Model(&models.OrganizationMember{}).
		Where("organization_id = ? AND LOWER(user_id) = LOWER(?)", orgID, userID).
		UpdateColumn("color", val).Error
}

func (r *OrganizationMembersRepository) Remove(orgID uuid.UUID, userID string) error {
	return r.db.Where("organization_id = ? AND LOWER(user_id) = LOWER(?)", orgID, userID).
		Delete(&models.OrganizationMember{}).Error
}
