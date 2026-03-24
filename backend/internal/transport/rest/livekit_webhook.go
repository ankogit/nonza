package rest

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	roomsvc "nonza/backend/internal/service/rooms"
	"nonza/backend/internal/transport/websocket"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type liveKitWebhookPayload struct {
	Event string `json:"event"`
	Room  struct {
		Name string `json:"name"`
	} `json:"room"`
}

func (h *Handler) HandleLiveKitWebhook(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		log.Printf("[webhook] livekit read body: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "read body"})
		return
	}

	var payload liveKitWebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		log.Printf("[webhook] livekit unmarshal: %v body=%s", err, string(body))
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid json"})
		return
	}
	log.Printf("[webhook] livekit payload: %+v", payload)
	roomName := payload.Room.Name
	log.Printf("[webhook] livekit raw event=%q room.name=%q", payload.Event, roomName)

	if roomName == "" {
		log.Printf("[webhook] livekit skip: room name empty")
		c.JSON(http.StatusOK, gin.H{})
		return
	}

	participantEvent := payload.Event == "participant_joined" ||
		payload.Event == "participant_left" ||
		payload.Event == "room_started" ||
		payload.Event == "track_published" ||
		payload.Event == "track_unpublished"
	if !participantEvent {
		log.Printf("[webhook] livekit skip: event %q not participant-related", payload.Event)
		c.JSON(http.StatusOK, gin.H{})
		return
	}

	const prefix = "room-"
	if !strings.HasPrefix(roomName, prefix) {
		log.Printf("[webhook] livekit skip: room name %q has no %q prefix", roomName, prefix)
		c.JSON(http.StatusOK, gin.H{})
		return
	}
	roomID, err := uuid.Parse(roomName[len(prefix):])
	if err != nil {
		log.Printf("[webhook] livekit room name %q invalid uuid: %v", roomName, err)
		c.JSON(http.StatusOK, gin.H{})
		return
	}
	room, err := h.services.Rooms.GetByID(roomID)
	if err != nil || room == nil {
		log.Printf("[webhook] livekit room not found name=%q err=%v", roomName, err)
		c.JSON(http.StatusOK, gin.H{})
		return
	}

	if (payload.Event == "participant_joined" || payload.Event == "participant_left") && h.livekit != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		parts, err := h.livekit.ListParticipants(ctx, room.LiveKitRoomName())
		if err != nil {
			log.Printf("[webhook] livekit room timer ListParticipants err=%v", err)
		} else if roomsvc.ApplyParticipantCountToRoomTimer(room, len(parts)) {
			if err := h.services.Rooms.Update(room); err != nil {
				log.Printf("[webhook] livekit room timer Update err=%v", err)
			}
		}
	}

	orgChannel := "org:" + room.OrganizationID.String()
	log.Printf("[webhook] livekit broadcasting participants_changed org=%s (room=%s)", orgChannel, roomName)
	wsPayload := map[string]interface{}{
		"room": roomName,
	}
	if room.Settings != nil {
		if v, ok := room.Settings["room_timer_started_at"].(string); ok && v != "" {
			wsPayload["room_timer_started_at"] = v
		}
	}
	msg := websocket.Message{
		Type:    "participants_changed",
		RoomID:  orgChannel,
		Payload: wsPayload,
	}
	if err := h.wsHub.BroadcastToRoom(orgChannel, msg); err != nil {
		log.Printf("[webhook] livekit BroadcastToRoom err=%v", err)
	} else {
		log.Printf("[webhook] livekit BroadcastToRoom ok org=%s", orgChannel)
	}
	c.JSON(http.StatusOK, gin.H{})
}
