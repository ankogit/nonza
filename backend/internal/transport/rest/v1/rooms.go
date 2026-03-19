package v1

import (
	"context"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	roomDto "nonza/backend/internal/dto/rooms"
	"nonza/backend/internal/models"
	"nonza/backend/internal/pkg/orgroles"
	"nonza/backend/internal/service"
	"nonza/backend/internal/transport/websocket"
	"nonza/backend/internal/webrtc/livekit"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const userIDContextKey = "user_id"

type RoomsHandler struct {
	Services *service.Services
	LiveKit  *livekit.Client
	WsHub    *websocket.Hub
}

func NewRoomsHandler(services *service.Services, lk *livekit.Client, wsHub *websocket.Hub) *RoomsHandler {
	return &RoomsHandler{Services: services, LiveKit: lk, WsHub: wsHub}
}

func (h *RoomsHandler) Create(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}

	userID, _ := c.Get(userIDContextKey)
	uid, _ := userID.(string)
	if uid == "" {
		org, err := h.Services.Organizations.GetByID(orgID)
		if err != nil || org == nil || org.OwnerID != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
			return
		}
	} else {
		ok, err := h.Services.Organizations.UserCanAccess(orgID, uid)
		if err != nil || !ok {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
		ok, err = h.Services.Organizations.UserHasPermission(orgID, uid, orgroles.PermissionCreateRoom)
		if err != nil || !ok {
			c.JSON(http.StatusForbidden, gin.H{"error": "no permission to create room"})
			return
		}
	}

	var req roomDto.CreateRoomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var expiresIn *time.Duration
	if req.ExpiresIn != "" {
		dur, err := time.ParseDuration(req.ExpiresIn)
		if err == nil {
			expiresIn = &dur
		}
	}

	var roomGroupID *uuid.UUID
	if req.RoomGroupID != nil && *req.RoomGroupID != "" {
		if uid == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "room_group_id not allowed for anonymous org"})
			return
		}
		gid, err := uuid.Parse(*req.RoomGroupID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid room_group_id"})
			return
		}
		group, err := h.Services.RoomGroups.GetByID(gid)
		if err != nil || group == nil || group.OrganizationID != orgID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "room group not found or does not belong to organization"})
			return
		}
		roomGroupID = &gid
	}

	allowAnonymousJoin := (uid == "")
	if req.AllowAnonymousJoin != nil {
		allowAnonymousJoin = *req.AllowAnonymousJoin
	}
	var createdByUserID *string
	if uid != "" {
		createdByUserID = &uid
	}
	if req.Password != nil && strings.TrimSpace(*req.Password) != "" && !allowAnonymousJoin {
		c.JSON(http.StatusBadRequest, gin.H{"error": "password can only be set for rooms with allow_anonymous_join"})
		return
	}
	room, err := h.Services.Rooms.Create(orgID, req.Name, models.RoomType(req.RoomType), req.IsTemporary, expiresIn, req.E2EEEnabled, roomGroupID, allowAnonymousJoin, req.Password, createdByUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if h.WsHub != nil {
		_ = h.WsHub.BroadcastToRoom("org:"+orgID.String(), map[string]interface{}{"type": "rooms_changed"})
	}
	c.JSON(http.StatusCreated, roomDto.ToRoomResponse(room, nil))
}

func (h *RoomsHandler) GetByShortCode(c *gin.Context) {
	shortCode := c.Param("shortCode")

	room, err := h.Services.Rooms.GetByShortCode(shortCode)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}

	allowAnonymous := false
	if room.Settings != nil {
		if v, ok := room.Settings["allow_anonymous_join"].(bool); ok {
			allowAnonymous = v
		}
	}
	if !allowAnonymous {
		userID, _ := c.Get(userIDContextKey)
		uid, _ := userID.(string)
		if uid == "" {
			c.JSON(http.StatusForbidden, gin.H{"error": "room does not allow anonymous access"})
			return
		}
		ok, err := h.Services.Organizations.UserCanAccess(room.OrganizationID, uid)
		if err != nil || !ok {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
	}

	userID, _ := c.Get(userIDContextKey)
	uid, _ := userID.(string)
	var currentUserOrgColor *string
	if uid != "" {
		currentUserOrgColor, _ = h.Services.Organizations.GetMemberColor(room.OrganizationID, uid)
	}
	c.JSON(http.StatusOK, roomDto.ToRoomResponse(room, currentUserOrgColor))
}

func (h *RoomsHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	room, err := h.Services.Rooms.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}

	c.JSON(http.StatusOK, roomDto.ToRoomResponse(room, nil))
}

func (h *RoomsHandler) GetRoomParticipants(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	room, err := h.Services.Rooms.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}

	userID, _ := c.Get(userIDContextKey)
	uid, _ := userID.(string)
	if uid == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
		return
	}
	ok, err := h.Services.Organizations.UserCanAccess(room.OrganizationID, uid)
	if err != nil || !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	if h.LiveKit == nil {
		c.JSON(http.StatusOK, []roomDto.ParticipantResponse{})
		return
	}

	participants, err := h.LiveKit.ListParticipants(c.Request.Context(), room.LiveKitRoomName())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list participants"})
		return
	}

	out := make([]roomDto.ParticipantResponse, len(participants))
	for i, p := range participants {
		out[i] = roomDto.ParticipantResponse{Identity: p.Identity, Name: p.Name}
	}
	c.JSON(http.StatusOK, out)
}

func (h *RoomsHandler) UpdateConferenceHallLeader(c *gin.Context) {
	shortCode := c.Param("shortCode")
	if shortCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "short_code required"})
		return
	}

	var req struct {
		LeaderIdentity *string `json:"leader_identity"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	room, err := h.Services.Rooms.GetByShortCode(shortCode)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}

	newSettings := make(models.JSONB)
	if room.Settings != nil {
		for k, v := range room.Settings {
			newSettings[k] = v
		}
	}
	if req.LeaderIdentity != nil && *req.LeaderIdentity != "" {
		newSettings["conference_hall_leader_id"] = *req.LeaderIdentity
	} else {
		delete(newSettings, "conference_hall_leader_id")
	}
	room.Settings = newSettings

	if err := h.Services.Rooms.Update(room); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update room"})
		return
	}
	if h.WsHub != nil {
		_ = h.WsHub.BroadcastToRoom("org:"+room.OrganizationID.String(), map[string]interface{}{"type": "rooms_changed"})
	}
	c.JSON(http.StatusOK, roomDto.ToRoomResponse(room, nil))
}

func (h *RoomsHandler) UpdateRoomSettings(c *gin.Context) {
	shortCode := c.Param("shortCode")
	if shortCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "short_code required"})
		return
	}

	room, err := h.Services.Rooms.GetByShortCode(shortCode)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}

	userID, _ := c.Get(userIDContextKey)
	uid, _ := userID.(string)
	if uid == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
		return
	}
	ok, err := h.Services.Organizations.UserCanAccess(room.OrganizationID, uid)
	if err != nil || !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}
	ok, err = h.Services.Organizations.UserHasPermission(room.OrganizationID, uid, orgroles.PermissionEditRoom)
	if err != nil || !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "no permission to edit room"})
		return
	}

	var req struct {
		AllowAnonymousJoin *bool   `json:"allow_anonymous_join"`
		RoomType           *string `json:"room_type"`
		Name               *string `json:"name"`
		RoomGroupID        *string `json:"room_group_id"`
		Password           *string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	newSettings := make(models.JSONB)
	if room.Settings != nil {
		for k, v := range room.Settings {
			newSettings[k] = v
		}
	}
	if req.AllowAnonymousJoin != nil {
		newSettings["allow_anonymous_join"] = *req.AllowAnonymousJoin
	}
	if req.Password != nil {
		allowAnonymous := false
		if v, ok := newSettings["allow_anonymous_join"].(bool); ok {
			allowAnonymous = v
		}
		if !allowAnonymous {
			c.JSON(http.StatusBadRequest, gin.H{"error": "password can only be set for rooms with allow_anonymous_join"})
			return
		}
		if *req.Password != "" {
			hash, err := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to set password"})
				return
			}
			newSettings["room_password_hash"] = string(hash)
		} else {
			delete(newSettings, "room_password_hash")
		}
	}
	room.Settings = newSettings

	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name cannot be empty"})
			return
		}
		room.Name = name
	}

	if req.RoomType != nil {
		switch *req.RoomType {
		case string(models.RoomTypeConferenceHall), string(models.RoomTypeRoundTable), string(models.RoomTypeTableCircle):
			room.RoomType = models.RoomType(*req.RoomType)
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "room_type must be conference_hall, round_table or table_circle"})
			return
		}
	}

	if req.RoomGroupID != nil {
		if *req.RoomGroupID == "" {
			room.RoomGroupID = nil
		} else {
			gid, err := uuid.Parse(*req.RoomGroupID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid room_group_id"})
				return
			}
			group, err := h.Services.RoomGroups.GetByID(gid)
			if err != nil || group == nil || group.OrganizationID != room.OrganizationID {
				c.JSON(http.StatusBadRequest, gin.H{"error": "room group not found or does not belong to organization"})
				return
			}
			room.RoomGroupID = &gid
		}
	}

	if err := h.Services.Rooms.Update(room); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update room"})
		return
	}
	if h.WsHub != nil {
		_ = h.WsHub.BroadcastToRoom("org:"+room.OrganizationID.String(), map[string]interface{}{"type": "rooms_changed"})
	}
	c.JSON(http.StatusOK, roomDto.ToRoomResponse(room, nil))
}

func (h *RoomsHandler) Delete(c *gin.Context) {
	shortCode := c.Param("shortCode")
	if shortCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "short_code required"})
		return
	}

	room, err := h.Services.Rooms.GetByShortCode(shortCode)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}

	userID, _ := c.Get(userIDContextKey)
	uid, _ := userID.(string)
	if uid == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
		return
	}
	ok, err := h.Services.Organizations.UserCanAccess(room.OrganizationID, uid)
	if err != nil || !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}
	ok, err = h.Services.Organizations.UserHasPermission(room.OrganizationID, uid, orgroles.PermissionDeleteRoom)
	if err != nil || !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "no permission to delete room"})
		return
	}

	if err := h.Services.Rooms.Delete(room.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete room"})
		return
	}
	orgID := room.OrganizationID
	if h.WsHub != nil {
		_ = h.WsHub.BroadcastToRoom("org:"+orgID.String(), map[string]interface{}{"type": "rooms_changed"})
	}
	c.Status(http.StatusNoContent)
}

func (h *RoomsHandler) GetByOrganizationID(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}

	userID, _ := c.Get(userIDContextKey)
	uid, _ := userID.(string)
	if uid == "" {
		org, err := h.Services.Organizations.GetByID(orgID)
		if err != nil || org == nil || org.OwnerID != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
			return
		}
	} else {
		ok, err := h.Services.Organizations.UserCanAccess(orgID, uid)
		if err != nil || !ok {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
	}

	rooms, err := h.Services.Rooms.GetByOrganizationID(orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	queryInclude := c.Query("include")
	liveKitNil := h.LiveKit == nil
	includeParticipants := queryInclude == "participants" && h.LiveKit != nil
	log.Printf("[rooms] GET org/%s/rooms include=%q livekit_nil=%v includeParticipants=%v rooms_count=%d",
		orgID, queryInclude, liveKitNil, includeParticipants, len(rooms))

	ctx := c.Request.Context()
	response := make([]roomDto.RoomWithParticipantsResponse, len(rooms))
	for i, r := range rooms {
		response[i] = roomDto.RoomWithParticipantsResponse{
			RoomResponse: roomDto.ToRoomResponse(&r, nil),
			Participants: []roomDto.ParticipantResponse{},
		}
	}

	if includeParticipants {
		listCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()
		var wg sync.WaitGroup
		for i, r := range rooms {
			wg.Add(1)
			go func(idx int, roomName string, roomID uuid.UUID) {
				defer wg.Done()
				participants, err := h.LiveKit.ListParticipants(listCtx, roomName)
				if err == nil {
					response[idx].Participants = make([]roomDto.ParticipantResponse, len(participants))
					for j, p := range participants {
						response[idx].Participants[j] = roomDto.ParticipantResponse{Identity: p.Identity, Name: p.Name}
					}
					log.Printf("[rooms] room %s livekit_room=%q participants=%d", roomID, roomName, len(participants))
				} else {
					log.Printf("[rooms] room %s livekit_room=%q ListParticipants err=%v", roomID, roomName, err)
				}
			}(i, r.LiveKitRoomName(), r.ID)
		}
		wg.Wait()
	}

	c.JSON(http.StatusOK, response)
}

func (h *RoomsHandler) UpdateOrder(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}

	userID, _ := c.Get(userIDContextKey)
	uid, _ := userID.(string)
	if uid == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
		return
	}
	ok, err := h.Services.Organizations.UserCanAccess(orgID, uid)
	if err != nil || !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}
	ok, err = h.Services.Organizations.UserHasPermission(orgID, uid, orgroles.PermissionEditRoom)
	if err != nil || !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "no permission to reorder rooms"})
		return
	}

	var req roomDto.UpdateRoomsOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	roomIDs := make([]uuid.UUID, 0, len(req.Order))
	for _, s := range req.Order {
		id, err := uuid.Parse(s)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid room id: " + s})
			return
		}
		roomIDs = append(roomIDs, id)
	}

	if err := h.Services.Rooms.UpdateOrder(orgID, roomIDs); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if h.WsHub != nil {
		_ = h.WsHub.BroadcastToRoom("org:"+orgID.String(), map[string]interface{}{"type": "rooms_changed"})
	}
	c.Status(http.StatusNoContent)
}

func (h *RoomsHandler) NotifyParticipantLeft(c *gin.Context) {
	shortCode := c.Param("shortCode")
	if shortCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "short_code required"})
		return
	}

	room, err := h.Services.Rooms.GetByShortCode(shortCode)
	if err != nil || room == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}

	userID, _ := c.Get(userIDContextKey)
	uid, _ := userID.(string)
	if uid == "" {
		allowAnonymous := false
		if room.Settings != nil {
			if v, ok := room.Settings["allow_anonymous_join"].(bool); ok {
				allowAnonymous = v
			}
		}
		if !allowAnonymous {
			c.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
			return
		}
	} else {
		ok, err := h.Services.Organizations.UserCanAccess(room.OrganizationID, uid)
		if err != nil || !ok {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
	}

	if h.WsHub == nil {
		c.JSON(http.StatusOK, gin.H{"ok": true})
		return
	}

	orgChannel := "org:" + room.OrganizationID.String()
	msg := websocket.Message{
		Type:   "participants_changed",
		RoomID: orgChannel,
		Payload: map[string]interface{}{
			"room": room.LiveKitRoomName(),
		},
	}
	if err := h.WsHub.BroadcastToRoom(orgChannel, msg); err != nil {
		log.Printf("[rooms] NotifyParticipantLeft BroadcastToRoom err=%v", err)
	}
	log.Printf("[rooms] NotifyParticipantLeft short_code=%s org=%s", shortCode, orgChannel)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
