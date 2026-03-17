package dto

import (
	"nonza/backend/internal/models"
	"time"

	"github.com/google/uuid"
)

func roomGroupIDPtr(id *uuid.UUID) *string {
	if id == nil {
		return nil
	}
	s := id.String()
	return &s
}

type CreateRoomRequest struct {
	Name        string  `json:"name" binding:"required"`
	RoomType    string  `json:"room_type" binding:"required,oneof=conference_hall round_table"`
	IsTemporary bool    `json:"is_temporary"`
	ExpiresIn   string  `json:"expires_in"`
	E2EEEnabled bool    `json:"e2ee_enabled"`
	RoomGroupID *string `json:"room_group_id"`
}

type RoomResponse struct {
	ID                     string     `json:"id"`
	OrganizationID         string     `json:"organization_id"`
	RoomGroupID            *string    `json:"room_group_id,omitempty"`
	Name                   string     `json:"name"`
	ShortCode              *string    `json:"short_code"`
	RoomType               string     `json:"room_type"`
	IsTemporary            bool       `json:"is_temporary"`
	ExpiresAt              *time.Time `json:"expires_at,omitempty"`
	LiveKitRoomName        string     `json:"livekit_room_name"`
	E2EEEnabled            bool       `json:"e2ee_enabled"`
	ConferenceHallLeaderID *string    `json:"conference_hall_leader_id"`
	CreatedByUserID        *string    `json:"created_by_user_id,omitempty"`
	AllowAnonymousJoin     bool       `json:"allow_anonymous_join"`
	PasswordProtected      bool       `json:"password_protected"`
	Position               int        `json:"position"`
	CreatedAt              time.Time  `json:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at"`
	CurrentUserOrgColor    *string    `json:"current_user_org_color,omitempty"`
}

func ToRoomResponse(room *models.Room, currentUserOrgColor *string) RoomResponse {
	e2ee := false
	var conferenceHallLeaderID *string
	var createdByUserID *string
	allowAnonymousJoin := false
	passwordProtected := false
	if room.Settings != nil {
		if v, ok := room.Settings["e2ee_enabled"].(bool); ok {
			e2ee = v
		}
		if v, ok := room.Settings["conference_hall_leader_id"].(string); ok && v != "" {
			conferenceHallLeaderID = &v
		}
		if v, ok := room.Settings["created_by_user_id"].(string); ok && v != "" {
			createdByUserID = &v
		}
		if v, ok := room.Settings["allow_anonymous_join"].(bool); ok {
			allowAnonymousJoin = v
		}
		if v, ok := room.Settings["room_password_hash"].(string); ok && v != "" {
			passwordProtected = true
		}
	}
	return RoomResponse{
		ID:                     room.ID.String(),
		OrganizationID:         room.OrganizationID.String(),
		RoomGroupID:            roomGroupIDPtr(room.RoomGroupID),
		Name:                   room.Name,
		ShortCode:              room.ShortCode,
		RoomType:               string(room.RoomType),
		IsTemporary:            room.IsTemporary,
		ExpiresAt:              room.ExpiresAt,
		LiveKitRoomName:        "room-" + room.ID.String(),
		E2EEEnabled:            e2ee,
		ConferenceHallLeaderID: conferenceHallLeaderID,
		CreatedByUserID:        createdByUserID,
		AllowAnonymousJoin:     allowAnonymousJoin,
		PasswordProtected:      passwordProtected,
		Position:               room.Position,
		CreatedAt:              room.CreatedAt,
		UpdatedAt:              room.UpdatedAt,
		CurrentUserOrgColor:    currentUserOrgColor,
	}
}

type ParticipantResponse struct {
	Identity string `json:"identity"`
	Name     string `json:"name"`
}

type RoomWithParticipantsResponse struct {
	RoomResponse
	Participants []ParticipantResponse `json:"participants"`
}

type UpdateRoomsOrderRequest struct {
	Order []string `json:"order"` // room IDs in desired display order (ungrouped first, then each group's rooms)
}
