package repository

import "nonza/backend/internal/models"

type OAuthRefreshTokens interface {
	Create(token *models.OAuthRefreshToken) error
	GetByJTI(jti string) (*models.OAuthRefreshToken, error)
	RevokeByJTI(jti string) error
	RevokeByTokenHash(tokenHash string) error
}
