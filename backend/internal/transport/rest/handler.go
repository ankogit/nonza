package rest

import (
	"strings"

	"nonza/backend/internal/config"
	"nonza/backend/internal/repository"
	"nonza/backend/internal/repository/redis"
	"nonza/backend/internal/service"
	v1 "nonza/backend/internal/transport/rest/v1"
	"nonza/backend/internal/transport/websocket"
	"nonza/backend/internal/webrtc/livekit"
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

	router.POST("/api/v1/webhooks/livekit", h.HandleLiveKitWebhook)

	api := router.Group("/api/v1")
	api.Use(AuthMiddleware(h.services))
	{
		h.initAuthRoutes(api)
		h.initOrganizationRoomsRoutes(api, cfg)
		h.initOrgRoomGroupsRoutes(api)
		h.initOrgInvitesRoutes(api)
		h.initOrganizationsRoutes(api)
		h.initRoomsRoutes(api, cfg)
		h.initInvitesRoutes(api)
		h.initTokensRoutes(api, cfg)
	}

	// WebSocket endpoints
	router.GET("/ws", h.wsHandler.HandleWebSocket)
	router.GET("/ws/org", h.wsHandler.HandleOrgParticipantsWS)

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

func (h *Handler) initOrganizationRoomsRoutes(api *gin.RouterGroup, cfg *config.Config) {
	roomHandler := v1.NewRoomsHandler(h.services, livekit.NewClient(cfg), h.wsHub)

	// Use /org/:id/rooms to completely avoid conflict with /organizations/:id
	// This is cleaner and avoids any route ambiguity
	orgRooms := api.Group("/org/:id/rooms")
	{
		orgRooms.POST("", roomHandler.Create)
		orgRooms.GET("", roomHandler.GetByOrganizationID)
		orgRooms.PATCH("order", roomHandler.UpdateOrder)
	}
}

func (h *Handler) initOrgRoomGroupsRoutes(api *gin.RouterGroup) {
	roomGroupsHandler := v1.NewRoomGroupsHandler(h.services)
	orgRoomGroups := api.Group("/org/:id/room-groups")
	{
		orgRoomGroups.GET("", roomGroupsHandler.List)
		orgRoomGroups.POST("", roomGroupsHandler.Create)
		orgRoomGroups.PATCH("/:groupId", roomGroupsHandler.Update)
		orgRoomGroups.DELETE("/:groupId", roomGroupsHandler.Delete)
	}
}

func (h *Handler) initOrgInvitesRoutes(api *gin.RouterGroup) {
	invitesHandler := v1.NewInvitesHandler(h.services)
	orgInvites := api.Group("/org/:id/invites")
	{
		orgInvites.POST("", invitesHandler.Create)
	}
}

func (h *Handler) initInvitesRoutes(api *gin.RouterGroup) {
	invitesHandler := v1.NewInvitesHandler(h.services)
	invites := api.Group("/invites")
	{
		invites.GET("/:token", invitesHandler.GetByToken)
		invites.POST("/:token/accept", invitesHandler.Accept)
	}
}

func (h *Handler) initOrganizationsRoutes(api *gin.RouterGroup) {
	orgHandler := v1.NewOrganizationsHandler(h.services, h.wsHub)

	orgs := api.Group("/organizations")
	{
		orgs.POST("", orgHandler.Create)
		orgs.GET("", orgHandler.GetList)
		orgs.GET("/:id", orgHandler.GetByID)
		orgs.PUT("/:id", orgHandler.Update)
		orgs.DELETE("/:id", orgHandler.Delete)
	}

	orgMembers := api.Group("/org/:id/members")
	{
		orgMembers.GET("", orgHandler.GetMembers)
		orgMembers.PATCH("/me", orgHandler.UpdateMyMemberColor)
		orgMembers.PATCH("/:userId", orgHandler.UpdateMemberRole)
		orgMembers.DELETE("/:userId", orgHandler.RemoveMember)
	}
}

func (h *Handler) initRoomsRoutes(api *gin.RouterGroup, cfg *config.Config) {
	roomHandler := v1.NewRoomsHandler(h.services, livekit.NewClient(cfg), h.wsHub)

	rooms := api.Group("/rooms")
	{
		rooms.GET("/:shortCode", roomHandler.GetByShortCode)
		rooms.GET("/id/:id", roomHandler.GetByID)
		rooms.GET("/id/:id/participants", roomHandler.GetRoomParticipants)
		rooms.PATCH("/:shortCode/conference-hall-leader", roomHandler.UpdateConferenceHallLeader)
		rooms.PATCH("/:shortCode/settings", roomHandler.UpdateRoomSettings)
		rooms.DELETE("/:shortCode", roomHandler.Delete)
		rooms.POST("/:shortCode/notify-participant-left", roomHandler.NotifyParticipantLeft)
	}
}

func (h *Handler) initTokensRoutes(api *gin.RouterGroup, cfg *config.Config) {
	tokenHandler := v1.NewTokensHandler(h.services, cfg, h.wsHub)

	tokens := api.Group("/tokens")
	{
		tokens.POST("", tokenHandler.GenerateToken)
	}
}

func (h *Handler) initAuthRoutes(api *gin.RouterGroup) {
	authHandler := v1.NewAuthHandler(h.services)
	auth := api.Group("/auth")
	{
	auth.POST("/register", authHandler.Register)
	auth.POST("/login", authHandler.Login)
	auth.POST("/refresh", authHandler.Refresh)
	auth.PATCH("/me", authHandler.UpdateMe)
	}
}
