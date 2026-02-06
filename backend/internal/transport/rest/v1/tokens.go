package v1

import (
	"net/http"
	"nonza/backend/internal/config"
	tokenDto "nonza/backend/internal/dto/tokens"
	"nonza/backend/internal/service"
	"nonza/backend/internal/transport/websocket"
	"nonza/backend/internal/webrtc/livekit"
	"nonza/backend/internal/webrtc/turn"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func normalizeTURNSecret(s string) string {
	s = strings.ReplaceAll(s, "\r", "")
	s = strings.ReplaceAll(s, "\n", "")
	return strings.TrimSpace(s)
}

type TokensHandler struct {
	Services *service.Services
	Config   *config.Config
	LiveKit  *livekit.Client
	WSHub    interface {
		BroadcastToRoom(roomID string, message interface{}) error
	}
}

func NewTokensHandler(services *service.Services, cfg *config.Config, wsHub interface {
	BroadcastToRoom(roomID string, message interface{}) error
}) *TokensHandler {
	return &TokensHandler{
		Services: services,
		Config:   cfg,
		LiveKit:  livekit.NewClient(cfg),
		WSHub:    wsHub,
	}
}

func (h *TokensHandler) GenerateToken(c *gin.Context) {
	var req tokenDto.GenerateTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	room, err := h.Services.Rooms.GetByShortCode(req.ShortCode)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}

	participantID := req.ParticipantID
	if participantID == "" {
		participantID = uuid.New().String()
	}

	token, err := h.LiveKit.GenerateAccessToken(
		room.LiveKitRoomName,
		participantID,
		req.ParticipantName,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	// Клиенту отдаём публичный URL (wss://), иначе браузер не достучится до ws://livekit:7880
	livekitURL := h.Config.WebRTCPublicURL
	if livekitURL == "" {
		livekitURL = h.Config.WebRTCURL
	}
	response := tokenDto.TokenResponse{
		Token:         token,
		URL:           livekitURL,
		RoomName:      room.LiveKitRoomName,
		ParticipantID: participantID,
	}
	if room.Settings != nil {
		if e2ee, _ := room.Settings["e2ee_enabled"].(bool); e2ee {
			if key, _ := room.Settings["encryption_key"].(string); key != "" {
				response.EncryptionKey = key
			}
		}
	}

	// If TURNURL is unset, clients use LiveKit's built-in TURN from the join response.
	if h.Config.TURNURL != "" && h.Config.TURNSecret != "" {
		secret := normalizeTURNSecret(h.Config.TURNSecret)
		if secret != "" {
			ttl := h.Config.TURNTTL
			if ttl <= 0 {
				ttl = 86400
			}
			username, credential := turn.LongTermCredentials(secret, ttl)
			response.IceServers = []tokenDto.ICEServer{{
				URLs:       []string{h.Config.TURNURL},
				Username:   username,
				Credential: credential,
			}}
		}
	}

	// Optionally broadcast event about new participant joining
	if h.WSHub != nil {
		// Get room ID from room (you may need to adjust this based on your room model)
		roomID := room.LiveKitRoomName // or room.ID.String() if you want to use UUID
		h.WSHub.BroadcastToRoom(roomID, websocket.Message{
			Type:   "participant_joining",
			RoomID: roomID,
			Payload: map[string]interface{}{
				"participant_id":   participantID,
				"participant_name": req.ParticipantName,
			},
		})
	}

	c.JSON(http.StatusOK, response)
}
