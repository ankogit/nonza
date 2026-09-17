package repository

import "nonza/backend/internal/models"

type OAuthCodes interface {
	Create(code *models.OAuthAuthorizationCode) error
	GetByCode(code string) (*models.OAuthAuthorizationCode, error)
	MarkUsed(id string) error
}
