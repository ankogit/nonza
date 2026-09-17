package postgresDB

import (
	"time"

	"nonza/backend/internal/models"

	"gorm.io/gorm"
)

type OAuthRefreshTokensRepository struct {
	db *gorm.DB
}

func NewOAuthRefreshTokensRepository(db *gorm.DB) *OAuthRefreshTokensRepository {
	return &OAuthRefreshTokensRepository{db: db}
}

func (r *OAuthRefreshTokensRepository) Create(token *models.OAuthRefreshToken) error {
	return r.db.Create(token).Error
}

func (r *OAuthRefreshTokensRepository) GetByJTI(jti string) (*models.OAuthRefreshToken, error) {
	var row models.OAuthRefreshToken
	if err := r.db.Where("jti = ?", jti).First(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *OAuthRefreshTokensRepository) RevokeByJTI(jti string) error {
	now := time.Now()
	return r.db.Model(&models.OAuthRefreshToken{}).
		Where("jti = ? AND revoked_at IS NULL", jti).
		Update("revoked_at", now).Error
}

func (r *OAuthRefreshTokensRepository) RevokeByTokenHash(tokenHash string) error {
	now := time.Now()
	return r.db.Model(&models.OAuthRefreshToken{}).
		Where("token_hash = ? AND revoked_at IS NULL", tokenHash).
		Update("revoked_at", now).Error
}
