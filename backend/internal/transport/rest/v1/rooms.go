package v1

import (
	"net/http"
	roomDto "nonza/backend/internal/dto/rooms"
	"nonza/backend/internal/models"
	"nonza/backend/internal/service"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type RoomsHandler struct {
	Services *service.Services
}

func NewRoomsHandler(services *service.Services) *RoomsHandler {
	return &RoomsHandler{Services: services}
}

func (h *RoomsHandler) Create(c *gin.Context) {
	// Use "id" param (same as organizations routes) to avoid route conflict
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
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

	room, err := h.Services.Rooms.Create(orgID, req.Name, models.RoomType(req.RoomType), req.IsTemporary, expiresIn)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, roomDto.ToRoomResponse(room))
}

func (h *RoomsHandler) GetByShortCode(c *gin.Context) {
	shortCode := c.Param("shortCode")

	room, err := h.Services.Rooms.GetByShortCode(shortCode)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}

	c.JSON(http.StatusOK, roomDto.ToRoomResponse(room))
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

	c.JSON(http.StatusOK, roomDto.ToRoomResponse(room))
}

func (h *RoomsHandler) GetByOrganizationID(c *gin.Context) {
	// Use "id" param (same as organizations routes) to avoid route conflict
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}

	rooms, err := h.Services.Rooms.GetByOrganizationID(orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	response := make([]roomDto.RoomResponse, len(rooms))
	for i, r := range rooms {
		response[i] = roomDto.ToRoomResponse(&r)
	}

	c.JSON(http.StatusOK, response)
}
