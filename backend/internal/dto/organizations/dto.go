package dto

import "nonza/backend/internal/models"

type CreateOrganizationRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

type UpdateOrganizationRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

type OrganizationResponse struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

func ToOrganizationResponse(org *models.Organization) OrganizationResponse {
	return OrganizationResponse{
		ID:          org.ID.String(),
		Name:        org.Name,
		Description: org.Description,
		CreatedAt:   org.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:   org.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}
