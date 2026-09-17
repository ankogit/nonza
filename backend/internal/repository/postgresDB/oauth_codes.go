package postgresDB

import (
	"time"

	"nonza/backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type OAuthCodesRepository struct {
	db *gorm.DB
}

func NewOAuthCodesRepository(db *gorm.DB) *OAuthCodesRepository {
	return &OAuthCodesRepository{db: db}
}

func (r *OAuthCodesRepository) Create(code *models.OAuthAuthorizationCode) error {
	return r.db.Create(code).Error
}

func (r *OAuthCodesRepository) GetByCode(code string) (*models.OAuthAuthorizationCode, error) {
	var row models.OAuthAuthorizationCode
	if err := r.db.Where("code = ?", code).First(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *OAuthCodesRepository) MarkUsed(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	now := time.Now()
	return r.db.Model(&models.OAuthAuthorizationCode{}).
		Where("id = ? AND used_at IS NULL", uid).
		Update("used_at", now).Error
}
