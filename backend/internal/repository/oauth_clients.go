package repository

import "nonza/backend/internal/models"

type OAuthClients interface {
	Create(client *models.OAuthClient) error
	GetByClientID(clientID string) (*models.OAuthClient, error)
	GetByID(id string) (*models.OAuthClient, error)
	Update(client *models.OAuthClient) error
	List() ([]models.OAuthClient, error)
}
