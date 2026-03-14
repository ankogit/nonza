package dto

import (
	"nonza/backend/internal/models"
	"time"
)

type RoomGroupResponse struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	Name           string    `json:"name"`
	Position       int       `json:"position"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func ToRoomGroupResponse(g *models.RoomGroup) RoomGroupResponse {
	return RoomGroupResponse{
		ID:             g.ID.String(),
		OrganizationID: g.OrganizationID.String(),
		Name:           g.Name,
		Position:       g.Position,
		CreatedAt:      g.CreatedAt,
		UpdatedAt:      g.UpdatedAt,
	}
}

type CreateRoomGroupRequest struct {
	Name     string `json:"name" binding:"required"`
	Position int    `json:"position"`
}

type UpdateRoomGroupRequest struct {
	Name     *string `json:"name"`
	Position *int    `json:"position"`
}
