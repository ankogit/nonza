package websocket

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"nonza/backend/internal/repository"
	"nonza/backend/internal/repository/redis"
	"github.com/google/uuid"
)

// Hub maintains the set of active clients and broadcasts messages to the clients
type Hub struct {
	clients     map[*Client]bool           // All registered clients
	broadcast   chan []byte                 // Broadcast channel for all clients
	register    chan *Client                // Channel for client registration
	unregister  chan *Client                // Channel for client unregistration
	rooms       map[string]map[*Client]bool // Room-based clients (roomID -> clients)
	redisClient *redis.Client               // Redis client for document state storage
	roomsRepo   repository.Rooms            // Repository for checking room expiration
	mu          sync.RWMutex                // Mutex for thread-safe access
}

// NewHub creates a new Hub with Redis support
func NewHub(redisClient *redis.Client, roomsRepo repository.Rooms) *Hub {
	return &Hub{
		clients:     make(map[*Client]bool),
		broadcast:   make(chan []byte, 256),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		rooms:       make(map[string]map[*Client]bool),
		redisClient: redisClient,
		roomsRepo:   roomsRepo,
	}
}

// Run starts the hub
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			var userJoinedMsg map[string]interface{}
			if client.roomID != "" {
				if h.rooms[client.roomID] == nil {
					h.rooms[client.roomID] = make(map[*Client]bool)
				}
				h.rooms[client.roomID][client] = true

				// Prepare user_joined message; send after unlock to avoid deadlock (broadcastToRoomExcluding takes RLock)
				userJoinedMsg = map[string]interface{}{
					"type":    "user_joined",
					"room_id": client.roomID,
					"user_id": client.userID,
					"payload": map[string]interface{}{
						"user_id": client.userID,
						"room_id": client.roomID,
					},
				}

				// Load document state from Redis for new client (async, doesn't block registration)
				go h.loadDocumentForClient(client)
			}
			h.mu.Unlock()

			// Notify existing participants (outside lock to avoid deadlock)
			if userJoinedMsg != nil {
				h.broadcastToRoomExcluding(client.roomID, userJoinedMsg, client)
			}
			log.Printf("Client registered. Total clients: %d", len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			roomID := client.roomID
			userID := client.userID
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				close(client.sendBinary)
				if roomID != "" {
					if roomClients, ok := h.rooms[roomID]; ok {
						delete(roomClients, client)
						if len(roomClients) == 0 {
							delete(h.rooms, roomID)
							// Note: Document cleanup for expired rooms is handled by cron job
						}
					}
				}
			}
			h.mu.Unlock()
			log.Printf("Client unregistered. Total clients: %d", len(h.clients))
			
			// Notify other clients in the room about disconnection
			// This helps them clean up stale awareness states
			if roomID != "" {
				h.broadcastToRoomExcluding(roomID, Message{
					Type:   "user_left",
					RoomID: roomID,
					UserID: userID,
					Payload: map[string]interface{}{
						"user_id": userID,
						"room_id": roomID,
					},
				}, nil)
			}

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				// Use goroutine with recover to safely send to potentially closed channel
				go func(cli *Client) {
					defer func() {
						if r := recover(); r != nil {
							log.Printf("Panic recovered while broadcasting to client %s: %v", cli.userID, r)
						}
					}()
					select {
					case cli.send <- message:
					default:
						// Channel is full or closed, skip this client
						log.Printf("Broadcast channel full or closed for client %s", cli.userID)
					}
				}(client)
			}
			h.mu.RUnlock()
		}
	}
}

// BroadcastToRoom sends a message to all clients in a specific room
func (h *Hub) BroadcastToRoom(roomID string, message interface{}) error {
	return h.broadcastToRoomExcluding(roomID, message, nil)
}

// broadcastToRoomExcluding sends a message to all clients in the room except excludeClient (nil = no exclude)
func (h *Hub) broadcastToRoomExcluding(roomID string, message interface{}, excludeClient *Client) error {
	h.mu.RLock()
	roomClients, ok := h.rooms[roomID]
	if !ok {
		h.mu.RUnlock()
		return nil
	}
	data, err := json.Marshal(message)
	if err != nil {
		h.mu.RUnlock()
		return err
	}
	for client := range roomClients {
		if client == excludeClient {
			continue
		}
		// Use goroutine with recover to safely send to potentially closed channel
		go func(cli *Client) {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("Panic recovered while sending to client %s: %v", cli.userID, r)
				}
			}()
			select {
			case cli.send <- data:
			default:
				// Channel is full or closed, skip this client
				log.Printf("Send channel full or closed for client %s", cli.userID)
			}
		}(client)
	}
	h.mu.RUnlock()
	return nil
}

// isRoomExpired checks if a room has expired
func (h *Hub) isRoomExpired(roomID string) bool {
	roomUUID, err := uuid.Parse(roomID)
	if err != nil {
		return false
	}
	
	room, err := h.roomsRepo.GetByID(roomUUID)
	if err != nil {
		return false
	}
	
	return room.ExpiresAt != nil && room.ExpiresAt.Before(time.Now())
}

// loadDocumentForClient loads document state from Redis and sends it to the client
func (h *Hub) loadDocumentForClient(client *Client) {
	// Check if room has expired
	if h.isRoomExpired(client.roomID) {
		log.Printf("Room %s has expired, not loading document", client.roomID)
		h.redisClient.DeleteDocumentState(client.roomID)
		return
	}
	
	// Load document state from Redis
	docState, err := h.redisClient.GetDocumentState(client.roomID)
	if err != nil {
		log.Printf("Error loading document state from Redis for room %s: %v", client.roomID, err)
		return
	}
	
	// Send document state even if empty (empty document is valid state)
	if docState != nil {
		select {
		case client.sendBinary <- docState:
			if len(docState) == 0 {
				log.Printf("Sent empty document state to client %s in room %s (document is empty)", client.userID, client.roomID)
			} else {
				log.Printf("Sent document state to client %s in room %s (size: %d bytes)", client.userID, client.roomID, len(docState))
			}
		default:
			log.Printf("Failed to send document state to client %s: channel full", client.userID)
		}
	}
}

// StoreRoomDocumentState stores full Y.js document state for the room in Redis.
// Only full state snapshots should be stored; incremental updates are not stored.
// If room has expired, document will be deleted instead of stored.
// Empty documents (len(data) == 0) are valid and should be stored to clear the document.
func (h *Hub) StoreRoomDocumentState(roomID string, data []byte) {
	// Check if room has expired
	if h.isRoomExpired(roomID) {
		log.Printf("Room %s has expired, deleting document", roomID)
		h.redisClient.DeleteDocumentState(roomID)
		return
	}
	
	// Get room to calculate TTL
	roomUUID, err := uuid.Parse(roomID)
	if err != nil {
		log.Printf("Invalid room ID format: %s", roomID)
		return
	}
	
	room, err := h.roomsRepo.GetByID(roomUUID)
	if err != nil {
		log.Printf("Room %s not found: %v", roomID, err)
		return
	}
	
	// Calculate TTL based on room expiration
	var ttl time.Duration
	if room.ExpiresAt != nil {
		ttl = time.Until(*room.ExpiresAt) + time.Hour // TTL until expiration + 1h buffer
		if ttl < 0 {
			// Should not happen (isRoomExpired already checked), but just in case
			h.redisClient.DeleteDocumentState(roomID)
			return
		}
	} else {
		ttl = 365 * 24 * time.Hour // No expiration - 1 year TTL
	}
	
	// Store in Redis (even if empty - empty document is valid state)
	if err := h.redisClient.SetDocumentState(roomID, data, ttl); err != nil {
		log.Printf("Error storing document state in Redis for room %s: %v", roomID, err)
		return
	}
	
	if len(data) == 0 {
		log.Printf("Stored empty document state in Redis for room %s (document cleared, TTL: %v)", roomID, ttl)
	} else {
		log.Printf("Stored document state in Redis for room %s (size: %d bytes, TTL: %v)", roomID, len(data), ttl)
	}
}

// BroadcastBinaryToRoom sends a binary message to all clients in a specific room (excluding sender).
// Does NOT update stored document state — only yjs_full_state updates the stored state.
func (h *Hub) BroadcastBinaryToRoom(roomID string, data []byte, excludeClient *Client) error {
	h.mu.RLock()
	roomClients, ok := h.rooms[roomID]
	if !ok {
		h.mu.RUnlock()
		log.Printf("Room %s not found or has no clients", roomID)
		return nil
	}
	clientsToNotify := make([]*Client, 0, len(roomClients))
	for client := range roomClients {
		if client != excludeClient {
			clientsToNotify = append(clientsToNotify, client)
		}
	}
	h.mu.RUnlock()

	log.Printf("Broadcasting Y.js update to %d clients in room %s", len(clientsToNotify), roomID)

	// Send updates to clients (outside of lock to avoid blocking)
	for _, client := range clientsToNotify {
		// Create a copy of the data for each client to avoid race conditions
		dataCopy := make([]byte, len(data))
		copy(dataCopy, data)

		// Use a goroutine with recover to safely send to potentially closed channel
		go func(cli *Client, data []byte) {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("Panic recovered while sending binary to client %s: %v", cli.userID, r)
				}
			}()
			
			select {
			case cli.sendBinary <- data:
				log.Printf("Sent Y.js update to client %s", cli.userID)
			default:
				// Channel is full, skip this client
				log.Printf("Binary send channel full for client %s", cli.userID)
			}
		}(client, dataCopy)
	}

	return nil
}

// BroadcastToAll sends a message to all connected clients
func (h *Hub) BroadcastToAll(message interface{}) error {
	data, err := json.Marshal(message)
	if err != nil {
		return err
	}

	h.broadcast <- data
	return nil
}

// GetRoomClientsCount returns the number of clients in a room
func (h *Hub) GetRoomClientsCount(roomID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if roomClients, ok := h.rooms[roomID]; ok {
		return len(roomClients)
	}
	return 0
}

// GetTotalClientsCount returns the total number of connected clients
func (h *Hub) GetTotalClientsCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}
