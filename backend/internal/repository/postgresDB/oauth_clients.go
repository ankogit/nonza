package postgresDB

import (
	"nonza/backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type OAuthClientsRepository struct {
	db *gorm.DB
}

func NewOAuthClientsRepository(db *gorm.DB) *OAuthClientsRepository {
	return &OAuthClientsRepository{db: db}
}

func (r *OAuthClientsRepository) Create(client *models.OAuthClient) error {
	return r.db.Create(client).Error
}

func (r *OAuthClientsRepository) GetByClientID(clientID string) (*models.OAuthClient, error) {
	var client models.OAuthClient
	if err := r.db.Where("client_id = ?", clientID).First(&client).Error; err != nil {
		return nil, err
	}
	return &client, nil
}

func (r *OAuthClientsRepository) GetByID(id string) (*models.OAuthClient, error) {
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, err
	}
	var client models.OAuthClient
	if err := r.db.Where("id = ?", uid).First(&client).Error; err != nil {
		return nil, err
	}
	return &client, nil
}

func (r *OAuthClientsRepository) Update(client *models.OAuthClient) error {
	return r.db.Save(client).Error
}

func (r *OAuthClientsRepository) List() ([]models.OAuthClient, error) {
	var clients []models.OAuthClient
	if err := r.db.Order("created_at DESC").Find(&clients).Error; err != nil {
		return nil, err
	}
	return clients, nil
}
