package websocket

import (
	"encoding/base64"
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period (must be less than pongWait)
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 512 * 1024 // 512KB
)

// Client is a middleman between the websocket connection and the hub
type Client struct {
	hub *Hub

	// The websocket connection
	conn *websocket.Conn

	// Buffered channel of outbound messages
	send chan []byte

	// Buffered channel of outbound binary messages
	sendBinary chan []byte

	// Room ID this client is connected to
	roomID string

	// User/participant ID
	userID string
}

// Message represents a WebSocket message
type Message struct {
	Type    string      `json:"type"`
	RoomID  string      `json:"room_id,omitempty"`
	UserID  string      `json:"user_id,omitempty"`
	Payload interface{} `json:"payload"`
}

// readPump pumps messages from the websocket connection to the hub
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		messageType, messageBytes, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Handle binary messages (Y.js updates)
		if messageType == websocket.BinaryMessage {
			if c.roomID != "" {
				c.hub.BroadcastBinaryToRoom(c.roomID, messageBytes, c)
			}
			continue
		}

		// Handle text messages (JSON)
		// Check if message looks like binary data (starts with non-printable characters)
		if len(messageBytes) > 0 && (messageBytes[0] < 32 && messageBytes[0] != 9 && messageBytes[0] != 10 && messageBytes[0] != 13) {
			// This looks like binary data sent as text, treat it as binary
			if c.roomID != "" {
				c.hub.BroadcastBinaryToRoom(c.roomID, messageBytes, c)
			}
			continue
		}

		var message Message
		if err := json.Unmarshal(messageBytes, &message); err != nil {
			log.Printf("Error unmarshaling message (type: %d, length: %d, first byte: %x): %v", messageType, len(messageBytes), messageBytes[0], err)
			continue
		}

		// Handle different message types
		switch message.Type {
		case "join_room":
			c.handleJoinRoom(message)
		case "leave_room":
			c.handleLeaveRoom(message)
		case "ping":
			c.handlePing()
		case "yjs_update":
			// Handle Y.js update wrapped in JSON
			if c.roomID != "" {
				c.handleYjsUpdate(message)
			}
		case "yjs_sync":
			// Handle Y.js sync request
			if c.roomID != "" {
				c.handleYjsSync(message)
			}
		case "yjs_full_state":
			// Handle Y.js full document state (Y.encodeStateAsUpdate) — store and broadcast to room
			if c.roomID != "" {
				c.handleYjsFullState(message)
			}
		case "yjs_awareness":
			// Handle Y.js awareness updates (cursor positions, user info) — broadcast only, don't store
			if c.roomID != "" {
				c.handleYjsAwareness(message)
			}
		default:
			// Broadcast custom message to room
			if c.roomID != "" {
				c.hub.BroadcastToRoom(c.roomID, message)
			}
		}
	}
}

// writePump pumps messages from the hub to the websocket connection
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to the current websocket message
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case binaryMessage, ok := <-c.sendBinary:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			log.Printf("Sending binary Y.js update to client %s (size: %d bytes)", c.userID, len(binaryMessage))
			if err := c.conn.WriteMessage(websocket.BinaryMessage, binaryMessage); err != nil {
				log.Printf("Error sending binary message to client %s: %v", c.userID, err)
				return
			}
			log.Printf("Successfully sent binary Y.js update to client %s", c.userID)

			// Send any queued binary messages
			n := len(c.sendBinary)
			for i := 0; i < n; i++ {
				queuedMsg := <-c.sendBinary
				log.Printf("Sending queued binary Y.js update to client %s (size: %d bytes)", c.userID, len(queuedMsg))
				if err := c.conn.WriteMessage(websocket.BinaryMessage, queuedMsg); err != nil {
					log.Printf("Error sending queued binary message to client %s: %v", c.userID, err)
					return
				}
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleJoinRoom handles a join room message
func (c *Client) handleJoinRoom(message Message) {
	if roomID, ok := message.Payload.(map[string]interface{})["room_id"].(string); ok {
		// Remove from old room
		if c.roomID != "" && c.roomID != roomID {
			c.hub.mu.Lock()
			if roomClients, ok := c.hub.rooms[c.roomID]; ok {
				delete(roomClients, c)
			}
			c.hub.mu.Unlock()
		}

		// Add to new room
		c.roomID = roomID
		c.hub.mu.Lock()
		if c.hub.rooms[roomID] == nil {
			c.hub.rooms[roomID] = make(map[*Client]bool)
		}
		c.hub.rooms[roomID][c] = true
		c.hub.mu.Unlock()

		// Notify others in the room
		c.hub.BroadcastToRoom(roomID, Message{
			Type:   "user_joined",
			RoomID: roomID,
			UserID: c.userID,
			Payload: map[string]interface{}{
				"user_id": c.userID,
				"room_id": roomID,
			},
		})
	}
}

// handleLeaveRoom handles a leave room message
func (c *Client) handleLeaveRoom(message Message) {
	if c.roomID != "" {
		roomID := c.roomID
		c.roomID = ""

		// Notify others in the room
		c.hub.BroadcastToRoom(roomID, Message{
			Type:   "user_left",
			RoomID: roomID,
			UserID: c.userID,
			Payload: map[string]interface{}{
				"user_id": c.userID,
				"room_id": roomID,
			},
		})
	}
}

// handlePing handles a ping message
func (c *Client) handlePing() {
	response := Message{
		Type: "pong",
	}
	data, _ := json.Marshal(response)
	c.send <- data
}

// handleYjsUpdate handles Y.js update messages wrapped in JSON
func (c *Client) handleYjsUpdate(message Message) {
	log.Printf("Received Y.js update from client %s in room %s", c.userID, c.roomID)
	
	// Extract base64 encoded update from payload
	payload, ok := message.Payload.(map[string]interface{})
	if !ok {
		// Try to get update directly from message
		if updateBase64, ok := message.Payload.(string); ok {
			// Decode base64 to binary
			updateBytes, err := base64.StdEncoding.DecodeString(updateBase64)
			if err != nil {
				log.Printf("Error decoding Y.js update: %v", err)
				return
			}
			log.Printf("Broadcasting Y.js update (size: %d bytes) to room %s", len(updateBytes), c.roomID)
			c.hub.BroadcastBinaryToRoom(c.roomID, updateBytes, c)
			return
		}
		log.Printf("Invalid payload format for Y.js update: %T", message.Payload)
		return
	}

	updateBase64, ok := payload["update"].(string)
	if !ok {
		log.Printf("Update field not found in payload, available keys: %v", getMapKeys(payload))
		return
	}

	// Decode base64 to binary
	updateBytes, err := base64.StdEncoding.DecodeString(updateBase64)
	if err != nil {
		log.Printf("Error decoding Y.js update: %v", err)
		return
	}

	log.Printf("Broadcasting Y.js update (size: %d bytes) to room %s", len(updateBytes), c.roomID)
	// Broadcast binary update to room (excluding sender)
	c.hub.BroadcastBinaryToRoom(c.roomID, updateBytes, c)
}

// Helper function to get map keys for logging
func getMapKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// Helper function to get value length for logging
func getValueLength(v interface{}) int {
	if str, ok := v.(string); ok {
		return len(str)
	}
	return 0
}

// Helper function to get first N characters of a string
func getFirstChars(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// handleYjsSync handles Y.js sync requests
func (c *Client) handleYjsSync(message Message) {
	log.Printf("Received Y.js sync request from client %s in room %s", c.userID, c.roomID)
	
	// Check if room has expired
	if c.hub.isRoomExpired(c.roomID) {
		log.Printf("Room %s has expired, not syncing document", c.roomID)
		c.hub.redisClient.DeleteDocumentState(c.roomID)
		c.sendSyncAck(false)
		return
	}
	
	// Get document state from Redis
	docState, err := c.hub.redisClient.GetDocumentState(c.roomID)
	if err != nil {
		log.Printf("Error loading document state from Redis for room %s: %v", c.roomID, err)
		c.sendSyncAck(false)
		return
	}
	
	hasState := docState != nil && len(docState) > 0
	if hasState {
		select {
		case c.sendBinary <- docState:
			log.Printf("Sent document state to client %s (size: %d bytes)", c.userID, len(docState))
		default:
			log.Printf("Failed to send document state to client %s: channel full", c.userID)
		}
	}
	
	c.sendSyncAck(hasState)
}

// sendSyncAck sends sync acknowledgment message
func (c *Client) sendSyncAck(synced bool) {
	response := Message{
		Type:   "yjs_sync_ack",
		RoomID: c.roomID,
		Payload: map[string]interface{}{
			"synced": synced,
		},
	}
	data, _ := json.Marshal(response)
	c.send <- data
}

// handleYjsFullState handles Y.js full document state (Y.encodeStateAsUpdate).
// Stores it for new joiners and broadcasts to all in room (excluding sender).
func (c *Client) handleYjsFullState(message Message) {
	payload, ok := message.Payload.(map[string]interface{})
	if !ok {
		log.Printf("Invalid payload for yjs_full_state: %T", message.Payload)
		return
	}
	updateBase64, ok := payload["update"].(string)
	if !ok {
		log.Printf("Update field not found in yjs_full_state payload")
		return
	}
	updateBytes, err := base64.StdEncoding.DecodeString(updateBase64)
	if err != nil {
		log.Printf("Error decoding yjs_full_state: %v", err)
		return
	}
	log.Printf("Received Y.js full state from client %s in room %s (size: %d bytes)", c.userID, c.roomID, len(updateBytes))
	// Store in Redis - this will also reset the TTL
	c.hub.StoreRoomDocumentState(c.roomID, updateBytes)
	c.hub.BroadcastBinaryToRoom(c.roomID, updateBytes, c)
}

// handleYjsAwareness handles Y.js awareness updates (cursor positions, user info).
// Broadcasts to room but does NOT store (awareness is ephemeral).
func (c *Client) handleYjsAwareness(message Message) {
	log.Printf("[handleYjsAwareness] Received yjs_awareness from client %s in room %s", c.userID, c.roomID)
	log.Printf("[handleYjsAwareness] Message payload type: %T", message.Payload)
	
	// Extract base64 encoded awareness update
	var updateBase64 string
	if updateStr, ok := message.Payload.(string); ok {
		log.Printf("[handleYjsAwareness] Payload is string, length: %d", len(updateStr))
		updateBase64 = updateStr
	} else if payload, ok := message.Payload.(map[string]interface{}); ok {
		log.Printf("[handleYjsAwareness] Payload is map, keys: %v", getMapKeys(payload))
		updateValue, exists := payload["update"]
		if !exists {
			log.Printf("[handleYjsAwareness] Update field does not exist in payload map")
		} else {
			log.Printf("[handleYjsAwareness] Update field exists, type: %T, value length: %d", updateValue, getValueLength(updateValue))
			if updateStr, ok := updateValue.(string); ok {
				log.Printf("[handleYjsAwareness] Update is string, length: %d, first 50 chars: %q", len(updateStr), getFirstChars(updateStr, 50))
				updateBase64 = updateStr
			} else {
				log.Printf("[handleYjsAwareness] Update is not a string, actual type: %T", updateValue)
			}
		}
	} else {
		log.Printf("[handleYjsAwareness] Unknown payload type: %T", message.Payload)
	}

	if updateBase64 == "" {
		log.Printf("[handleYjsAwareness] Update field not found in yjs_awareness payload (empty after extraction)")
		log.Printf("[handleYjsAwareness] Skipping empty awareness update")
		return
	}

	log.Printf("[handleYjsAwareness] Decoding base64 update, length: %d", len(updateBase64))
	updateBytes, err := base64.StdEncoding.DecodeString(updateBase64)
	if err != nil {
		log.Printf("[handleYjsAwareness] Error decoding base64: %v", err)
		return
	}
	log.Printf("[handleYjsAwareness] Successfully decoded, binary size: %d bytes", len(updateBytes))

	log.Printf("Broadcasting Y.js awareness update from client %s in room %s (size: %d bytes)", c.userID, c.roomID, len(updateBytes))
	// Broadcast awareness update as binary (don't store - awareness is ephemeral)
	c.hub.BroadcastBinaryToRoom(c.roomID, updateBytes, c)
}
