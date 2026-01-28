package organizations

import (
	"log"
	"nonza/backend/internal/models"
	"nonza/backend/internal/repository"

	"github.com/google/uuid"
)

type organizationsService struct {
	repo repository.Organizations
}

func (s *organizationsService) Create(name, description string) (*models.Organization, error) {
	log.Printf("[OrganizationsService] Create called: name=%s, description=%s", name, description)
	
	org := &models.Organization{
		Name:        name,
		Description: description,
		Settings:    make(models.JSONB),
	}

	log.Printf("[OrganizationsService] Calling repository.Create for organization: name=%s", name)
	if err := s.repo.Create(org); err != nil {
		log.Printf("[OrganizationsService] Repository.Create failed: %v", err)
		return nil, err
	}

	log.Printf("[OrganizationsService] Successfully created organization: id=%s, name=%s", org.ID, org.Name)
	return org, nil
}

func (s *organizationsService) GetByID(id uuid.UUID) (*models.Organization, error) {
	return s.repo.GetByID(id)
}

func (s *organizationsService) Update(id uuid.UUID, name, description string) (*models.Organization, error) {
	org, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}

	org.Name = name
	org.Description = description

	if err := s.repo.Update(org); err != nil {
		return nil, err
	}

	return org, nil
}

func (s *organizationsService) Delete(id uuid.UUID) error {
	return s.repo.Delete(id)
}
