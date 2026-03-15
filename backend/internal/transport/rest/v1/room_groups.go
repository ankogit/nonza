package v1

import (
	"net/http"
	"strings"

	roomGroupDto "nonza/backend/internal/dto/room_groups"
	"nonza/backend/internal/pkg/orgroles"
	"nonza/backend/internal/service"
	"nonza/backend/internal/transport/websocket"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type RoomGroupsHandler struct {
	Services *service.Services
	WsHub    *websocket.Hub
}

func NewRoomGroupsHandler(services *service.Services, wsHub *websocket.Hub) *RoomGroupsHandler {
	return &RoomGroupsHandler{Services: services, WsHub: wsHub}
}

func (h *RoomGroupsHandler) List(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}

	userID, _ := c.Get(userIDContextKey)
	uid, _ := userID.(string)
	if uid == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
		return
	}
	ok, err := h.Services.Organizations.UserCanAccess(orgID, uid)
	if err != nil || !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	groups, err := h.Services.RoomGroups.GetByOrganizationID(orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	out := make([]roomGroupDto.RoomGroupResponse, len(groups))
	for i := range groups {
		out[i] = roomGroupDto.ToRoomGroupResponse(&groups[i])
	}
	c.JSON(http.StatusOK, out)
}

func (h *RoomGroupsHandler) Create(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}

	userID, _ := c.Get(userIDContextKey)
	uid, _ := userID.(string)
	if uid == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
		return
	}
	ok, err := h.Services.Organizations.UserCanAccess(orgID, uid)
	if err != nil || !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}
	ok, err = h.Services.Organizations.UserHasPermission(orgID, uid, orgroles.PermissionEditRoom)
	if err != nil || !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "no permission to manage room groups"})
		return
	}

	var req roomGroupDto.CreateRoomGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name cannot be empty"})
		return
	}

	group, err := h.Services.RoomGroups.Create(orgID, name, req.Position)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if h.WsHub != nil {
		_ = h.WsHub.BroadcastToRoom("org:"+orgID.String(), map[string]interface{}{"type": "rooms_changed"})
	}
	c.JSON(http.StatusCreated, roomGroupDto.ToRoomGroupResponse(group))
}

func (h *RoomGroupsHandler) Update(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}
	groupID, err := uuid.Parse(c.Param("groupId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	userID, _ := c.Get(userIDContextKey)
	uid, _ := userID.(string)
	if uid == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
		return
	}
	ok, err := h.Services.Organizations.UserHasPermission(orgID, uid, orgroles.PermissionEditRoom)
	if err != nil || !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "no permission to manage room groups"})
		return
	}

	var req roomGroupDto.UpdateRoomGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name cannot be empty"})
			return
		}
		req.Name = &name
	}

	group, err := h.Services.RoomGroups.Update(groupID, orgID, req.Name, req.Position)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if h.WsHub != nil {
		_ = h.WsHub.BroadcastToRoom("org:"+orgID.String(), map[string]interface{}{"type": "rooms_changed"})
	}
	c.JSON(http.StatusOK, roomGroupDto.ToRoomGroupResponse(group))
}

func (h *RoomGroupsHandler) Delete(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}
	groupID, err := uuid.Parse(c.Param("groupId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	userID, _ := c.Get(userIDContextKey)
	uid, _ := userID.(string)
	if uid == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
		return
	}
	ok, err := h.Services.Organizations.UserHasPermission(orgID, uid, orgroles.PermissionEditRoom)
	if err != nil || !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "no permission to manage room groups"})
		return
	}

	if err := h.Services.RoomGroups.Delete(groupID, orgID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if h.WsHub != nil {
		_ = h.WsHub.BroadcastToRoom("org:"+orgID.String(), map[string]interface{}{"type": "rooms_changed"})
	}
	c.Status(http.StatusNoContent)
}
