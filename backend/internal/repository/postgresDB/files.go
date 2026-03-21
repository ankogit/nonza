package postgresDB

import (
	"nonza/backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type FilesRepository struct {
	db *gorm.DB
}

func NewFilesRepository(db *gorm.DB) *FilesRepository {
	return &FilesRepository{db: db}
}

func (r *FilesRepository) Create(file *models.StoredFile) error {
	return r.db.Create(file).Error
}

func (r *FilesRepository) GetByID(id uuid.UUID) (*models.StoredFile, error) {
	var file models.StoredFile
	if err := r.db.Where("id = ?", id).First(&file).Error; err != nil {
		return nil, err
	}
	return &file, nil
}

func (r *FilesRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.StoredFile{}, "id = ?", id).Error
}

