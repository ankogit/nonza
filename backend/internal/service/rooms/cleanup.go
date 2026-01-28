package rooms

import (
	"log"
	"nonza/backend/internal/repository/redis"
	"time"
)

// CleanupExpiredRooms periodically checks for expired rooms and cleans up their documents
func CleanupExpiredRooms(roomsService Rooms, redisClient *redis.Client, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	log.Printf("Started expired rooms cleanup task (interval: %v)", interval)

	// Run immediately on start
	cleanupExpiredRooms(roomsService, redisClient)

	for range ticker.C {
		cleanupExpiredRooms(roomsService, redisClient)
	}
}

func cleanupExpiredRooms(roomsService Rooms, redisClient *redis.Client) {
	expiredRooms, err := roomsService.GetExpired()
	if err != nil {
		log.Printf("Error getting expired rooms: %v", err)
		return
	}

	if len(expiredRooms) == 0 {
		return
	}

	log.Printf("Found %d expired rooms, cleaning up documents", len(expiredRooms))

	for _, room := range expiredRooms {
		roomID := room.ID.String()
		
		// Delete document from Redis
		if err := redisClient.DeleteDocumentState(roomID); err != nil {
			log.Printf("Error deleting document for expired room %s: %v", roomID, err)
		} else {
			log.Printf("Deleted document for expired room %s", roomID)
		}
	}

	// Delete expired rooms from database
	if err := roomsService.DeleteExpired(); err != nil {
		log.Printf("Error deleting expired rooms from database: %v", err)
	} else {
		log.Printf("Deleted %d expired rooms from database", len(expiredRooms))
	}
}
