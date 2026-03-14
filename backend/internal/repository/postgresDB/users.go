package postgresDB

import (
	"nonza/backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UsersRepository struct {
	db *gorm.DB
}

func NewUsersRepository(db *gorm.DB) *UsersRepository {
	return &UsersRepository{db: db}
}

func (r *UsersRepository) Create(user *models.User) error {
	return r.db.Create(user).Error
}

func (r *UsersRepository) GetByID(id uuid.UUID) (*models.User, error) {
	var u models.User
	if err := r.db.Where("id = ?", id).First(&u).Error; err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UsersRepository) GetByEmail(email string) (*models.User, error) {
	var u models.User
	if err := r.db.Where("email = ?", email).First(&u).Error; err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UsersRepository) Update(user *models.User) error {
	return r.db.Save(user).Error
}
