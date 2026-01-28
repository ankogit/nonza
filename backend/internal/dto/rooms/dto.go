package dto

import (
	"nonza/backend/internal/models"
	"time"
)

type CreateRoomRequest struct {
	Name        string `json:"name" binding:"required"`
	RoomType    string `json:"room_type" binding:"required,oneof=conference_hall round_table"`
	IsTemporary bool   `json:"is_temporary"`
	ExpiresIn   string `json:"expires_in"`
}

type RoomResponse struct {
	ID              string     `json:"id"`
	OrganizationID  string     `json:"organization_id"`
	Name            string     `json:"name"`
	ShortCode       *string    `json:"short_code"`
	RoomType        string     `json:"room_type"`
	IsTemporary     bool       `json:"is_temporary"`
	ExpiresAt       *time.Time `json:"expires_at,omitempty"`
	LiveKitRoomName string     `json:"livekit_room_name"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

func ToRoomResponse(room *models.Room) RoomResponse {
	return RoomResponse{
		ID:              room.ID.String(),
		OrganizationID:  room.OrganizationID.String(),
		Name:            room.Name,
		ShortCode:       room.ShortCode,
		RoomType:        string(room.RoomType),
		IsTemporary:     room.IsTemporary,
		ExpiresAt:       room.ExpiresAt,
		LiveKitRoomName: room.LiveKitRoomName,
		CreatedAt:       room.CreatedAt,
		UpdatedAt:       room.UpdatedAt,
	}
}
