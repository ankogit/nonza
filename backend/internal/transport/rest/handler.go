package rest

import (
	"strings"

	"nonza/backend/internal/config"
	"nonza/backend/internal/repository"
	"nonza/backend/internal/repository/redis"
	"nonza/backend/internal/service"
	v1 "nonza/backend/internal/transport/rest/v1"
	"nonza/backend/internal/transport/websocket"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	services  *service.Services
	wsHub     *websocket.Hub
	wsHandler *websocket.Handler
}

func NewHandler(services *service.Services, redisClient *redis.Client, roomsRepo repository.Rooms, documentTTL string) *Handler {
	wsHub := websocket.NewHub(redisClient, roomsRepo)
	wsHandler := websocket.NewHandler(wsHub)

	// Start the hub
	go wsHub.Run()

	return &Handler{
		services:  services,
		wsHub:     wsHub,
		wsHandler: wsHandler,
	}
}

func (h *Handler) InitRoutes(cfg *config.Config) *gin.Engine {
	router := gin.Default()

	// CORS middleware
	corsConfig := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Content-Length", "Accept-Encoding", "X-CSRF-Token", "Authorization", "accept", "origin", "Cache-Control", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}

	// In development, allow all origins
	if cfg.Env == "local" || cfg.Debug {
		corsConfig.AllowOriginFunc = func(origin string) bool {
			return true
		}
	} else {
		// In production: CORS_ALLOWED_ORIGINS (через запятую) или localhost по умолчанию
		origins := []string{
			"http://localhost:3000",
			"http://localhost:3001",
			"http://127.0.0.1:3000",
			"http://127.0.0.1:3001",
		}
		if cfg.CORSAllowedOrigins != "" {
			for _, o := range strings.Split(cfg.CORSAllowedOrigins, ",") {
				if trimmed := strings.TrimSpace(o); trimmed != "" {
					origins = append(origins, trimmed)
				}
			}
		}
		corsConfig.AllowOrigins = origins
	}

	router.Use(cors.New(corsConfig))

	api := router.Group("/api/v1")
	{
		// Register organization rooms routes FIRST (more specific path) to avoid conflicts
		// Must be before /organizations/:id routes
		h.initOrganizationRoomsRoutes(api)
		// Then register general organizations routes
		h.initOrganizationsRoutes(api)
		// Then register general rooms routes
		h.initRoomsRoutes(api)
		// Finally register tokens
		h.initTokensRoutes(api, cfg)
	}

	// WebSocket endpoint
	router.GET("/ws", h.wsHandler.HandleWebSocket)

	return router
}

// GetWSHub returns the WebSocket hub for broadcasting messages
func (h *Handler) GetWSHub() *websocket.Hub {
	return h.wsHub
}

// GetWSHandler returns the WebSocket handler
func (h *Handler) GetWSHandler() *websocket.Handler {
	return h.wsHandler
}

func (h *Handler) initOrganizationRoomsRoutes(api *gin.RouterGroup) {
	roomHandler := v1.NewRoomsHandler(h.services)

	// Use /org/:id/rooms to completely avoid conflict with /organizations/:id
	// This is cleaner and avoids any route ambiguity
	orgRooms := api.Group("/org/:id/rooms")
	{
		orgRooms.POST("", roomHandler.Create)
		orgRooms.GET("", roomHandler.GetByOrganizationID)
	}
}

func (h *Handler) initOrganizationsRoutes(api *gin.RouterGroup) {
	orgHandler := v1.NewOrganizationsHandler(h.services)

	orgs := api.Group("/organizations")
	{
		orgs.POST("", orgHandler.Create)
		orgs.GET("/:id", orgHandler.GetByID)
		orgs.PUT("/:id", orgHandler.Update)
		orgs.DELETE("/:id", orgHandler.Delete)
	}
}

func (h *Handler) initRoomsRoutes(api *gin.RouterGroup) {
	roomHandler := v1.NewRoomsHandler(h.services)

	rooms := api.Group("/rooms")
	{
		rooms.GET("/:shortCode", roomHandler.GetByShortCode)
		rooms.GET("/id/:id", roomHandler.GetByID)
	}
}

func (h *Handler) initTokensRoutes(api *gin.RouterGroup, cfg *config.Config) {
	tokenHandler := v1.NewTokensHandler(h.services, cfg, h.wsHub)

	tokens := api.Group("/tokens")
	{
		tokens.POST("", tokenHandler.GenerateToken)
	}
}
