package websocket

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins in development
		// In production, you should check the origin
		return true
	},
}

// Handler handles WebSocket connections
type Handler struct {
	hub *Hub
}

// NewHandler creates a new WebSocket handler
func NewHandler(hub *Hub) *Handler {
	return &Handler{
		hub: hub,
	}
}

// HandleWebSocket handles WebSocket upgrade requests
func (h *Handler) HandleWebSocket(c *gin.Context) {
	// Get room ID and user ID from query params or headers
	roomID := c.Query("room_id")
	userID := c.Query("user_id")

	if roomID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "room_id is required"})
		return
	}

	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id is required"})
		return
	}

	// Upgrade connection to WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	// Create new client
	client := &Client{
		hub:        h.hub,
		conn:       conn,
		send:       make(chan []byte, 256),
		sendBinary: make(chan []byte, 256),
		roomID:     roomID,
		userID:     userID,
	}

	// Register client
	client.hub.register <- client

	// Start client goroutines
	go client.writePump()
	go client.readPump()

	// Send welcome message
	welcomeMsg := Message{
		Type:   "connected",
		RoomID: roomID,
		UserID: userID,
		Payload: map[string]interface{}{
			"message": "Connected to WebSocket server",
			"room_id": roomID,
		},
	}
	data, _ := json.Marshal(welcomeMsg)
	client.send <- data
}

// BroadcastEvent allows sending custom events to a room
func (h *Handler) BroadcastEvent(roomID string, eventType string, payload interface{}) error {
	message := Message{
		Type:    eventType,
		RoomID:  roomID,
		Payload: payload,
	}
	return h.hub.BroadcastToRoom(roomID, message)
}
