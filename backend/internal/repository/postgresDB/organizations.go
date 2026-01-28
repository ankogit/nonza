package postgresDB

import (
	"log"
	"nonza/backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type OrganizationsRepository struct {
	db *gorm.DB
}

func NewOrganizationsRepository(db *gorm.DB) *OrganizationsRepository {
	return &OrganizationsRepository{db: db}
}

func (r *OrganizationsRepository) Create(org *models.Organization) error {
	log.Printf("[OrganizationsRepository] Create called: name=%s", org.Name)
	
	// Check database connection
	sqlDB, err := r.db.DB()
	if err != nil {
		log.Printf("[OrganizationsRepository] Failed to get underlying sql.DB: %v", err)
		return err
	}
	
	if err := sqlDB.Ping(); err != nil {
		log.Printf("[OrganizationsRepository] Database ping failed: %v", err)
		return err
	}
	log.Printf("[OrganizationsRepository] Database connection OK")
	
	log.Printf("[OrganizationsRepository] Executing INSERT for organization: name=%s", org.Name)
	if err := r.db.Create(org).Error; err != nil {
		log.Printf("[OrganizationsRepository] INSERT failed: %v", err)
		return err
	}
	
	log.Printf("[OrganizationsRepository] Successfully created organization: id=%s", org.ID)
	return nil
}

func (r *OrganizationsRepository) GetByID(id uuid.UUID) (*models.Organization, error) {
	var org models.Organization
	err := r.db.Where("id = ?", id).First(&org).Error
	if err != nil {
		return nil, err
	}
	return &org, nil
}

func (r *OrganizationsRepository) Update(org *models.Organization) error {
	return r.db.Save(org).Error
}

func (r *OrganizationsRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Organization{}, "id = ?", id).Error
}
