package organizations

import "nonza/backend/internal/repository"

func NewOrganizationsService(repo repository.Organizations) Organizations {
	return &organizationsService{repo: repo}
}
