package v1

import (
	"log"
	"net/http"
	"time"

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
	start := time.Now()
	var req tokenDto.GenerateTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	t0 := time.Now()
	room, err := h.Services.Rooms.GetByShortCode(req.ShortCode)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}
	log.Printf("[tokens] GetByShortCode %s: %v", req.ShortCode, time.Since(t0))

	allowAnonymous := false
	if room.Settings != nil {
		if v, ok := room.Settings["allow_anonymous_join"].(bool); ok {
			allowAnonymous = v
		}
	}
	if !allowAnonymous {
		userID, _ := c.Get("user_id")
		uid, _ := userID.(string)
		if uid == "" {
			c.JSON(http.StatusForbidden, gin.H{"error": "room does not allow anonymous join"})
			return
		}
		t1 := time.Now()
		ok, err := h.Services.Organizations.UserCanAccess(room.OrganizationID, uid)
		if err != nil || !ok {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
		log.Printf("[tokens] UserCanAccess: %v", time.Since(t1))
	}

	participantID := req.ParticipantID
	if participantID == "" {
		participantID = uuid.New().String()
	}

	t2 := time.Now()
	token, err := h.LiveKit.GenerateAccessToken(
		room.LiveKitRoomName(),
		participantID,
		req.ParticipantName,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}
	log.Printf("[tokens] GenerateAccessToken: %v", time.Since(t2))

	// Клиенту отдаём публичный URL (wss://), иначе браузер не достучится до ws://livekit:7880
	livekitURL := h.Config.WebRTCPublicURL
	if livekitURL == "" {
		livekitURL = h.Config.WebRTCURL
	}
	response := tokenDto.TokenResponse{
		Token:         token,
		URL:           livekitURL,
		RoomName:      room.LiveKitRoomName(),
		ParticipantID: participantID,
	}
	if room.Settings != nil {
		if e2ee, _ := room.Settings["e2ee_enabled"].(bool); e2ee {
			if key, _ := room.Settings["encryption_key"].(string); key != "" {
				response.EncryptionKey = key
			}
		}
	}

	if h.Config.TURNURL != "" && h.Config.TURNSecret != "" {
		t3 := time.Now()
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
		log.Printf("[tokens] TURN credentials: %v", time.Since(t3))
	}

	// Optionally broadcast event about new participant joining
	if h.WSHub != nil {
		// Get room ID from room (you may need to adjust this based on your room model)
		roomID := room.LiveKitRoomName()
		h.WSHub.BroadcastToRoom(roomID, websocket.Message{
			Type:   "participant_joining",
			RoomID: roomID,
			Payload: map[string]interface{}{
				"participant_id":   participantID,
				"participant_name": req.ParticipantName,
			},
		})
	}

	log.Printf("[tokens] total %v short_code=%s", time.Since(start), req.ShortCode)
	c.JSON(http.StatusOK, response)
}
