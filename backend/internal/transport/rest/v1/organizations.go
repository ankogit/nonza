package v1

import (
	"errors"
	"net/http"
	orgDto "nonza/backend/internal/dto/organizations"
	"nonza/backend/internal/service"
	"nonza/backend/internal/service/organizations"
	"nonza/backend/internal/transport/websocket"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type OrganizationsHandler struct {
	Services *service.Services
	WsHub    *websocket.Hub
}

func NewOrganizationsHandler(services *service.Services, wsHub *websocket.Hub) *OrganizationsHandler {
	return &OrganizationsHandler{Services: services, WsHub: wsHub}
}

func (h *OrganizationsHandler) broadcastOrgMembersChanged(orgID uuid.UUID) {
	if h.WsHub == nil {
		return
	}
	channel := "org:" + orgID.String()
	msg := map[string]interface{}{"type": "org_members_changed"}
	_ = h.WsHub.BroadcastToRoom(channel, msg)
}

func (h *OrganizationsHandler) broadcastOrganizationChanged(orgID uuid.UUID) {
	if h.WsHub == nil {
		return
	}
	channel := "org:" + orgID.String()
	msg := map[string]interface{}{"type": "organization_changed"}
	_ = h.WsHub.BroadcastToRoom(channel, msg)
}

func (h *OrganizationsHandler) Create(c *gin.Context) {
	var req orgDto.CreateOrganizationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.GetString("user_id")
	var ownerID *string
	if userID != "" {
		ownerID = &userID
	}

	org, err := h.Services.Organizations.Create(req.Name, req.Description, ownerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, orgDto.ToOrganizationResponse(org))
}

func (h *OrganizationsHandler) GetList(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
		return
	}

	userIDPtr := &userID
	orgs, err := h.Services.Organizations.List(userIDPtr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	resp := make([]orgDto.OrganizationResponse, len(orgs))
	for i, org := range orgs {
		resp[i] = orgDto.ToOrganizationResponse(org)
	}
	c.JSON(http.StatusOK, resp)
}

func (h *OrganizationsHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	org, err := h.Services.Organizations.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "organization not found"})
		return
	}

	userID := c.GetString("user_id")
	if userID == "" {
		if org.OwnerID != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
			return
		}
		c.JSON(http.StatusOK, orgDto.ToOrganizationResponse(org))
		return
	}

	canAccess, err := h.Services.Organizations.UserCanAccess(id, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if !canAccess {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	c.JSON(http.StatusOK, orgDto.ToOrganizationResponse(org))
}

func (h *OrganizationsHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var req orgDto.UpdateOrganizationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
		return
	}

	org, err := h.Services.Organizations.Update(id, req.Name, req.Description, userID)
	if err != nil {
		if errors.Is(err, organizations.ErrForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.broadcastOrganizationChanged(id)
	c.JSON(http.StatusOK, orgDto.ToOrganizationResponse(org))
}

func (h *OrganizationsHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.Services.Organizations.Delete(c.Request.Context(), id, userID); err != nil {
		if errors.Is(err, organizations.ErrForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *OrganizationsHandler) GetMembers(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
		return
	}
	list, err := h.Services.Organizations.GetMembers(orgID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *OrganizationsHandler) UpdateMyMemberColor(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	var req struct {
		Color *string `json:"color"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.Services.Organizations.UpdateMemberColor(orgID, userID, req.Color); err != nil {
		if errors.Is(err, organizations.ErrInvalidColor) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid color format"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.broadcastOrgMembersChanged(orgID)
	member, err := h.Services.Organizations.GetMember(orgID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, member)
}

func (h *OrganizationsHandler) UpdateMemberRole(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}
	targetUserID := c.Param("userId")
	if targetUserID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user id required"})
		return
	}
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
		return
	}
	var req struct {
		Role string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.Services.Organizations.UpdateMemberRole(orgID, targetUserID, req.Role, userID); err != nil {
		if errors.Is(err, organizations.ErrForbidden) || errors.Is(err, organizations.ErrCannotChangeOwner) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.broadcastOrgMembersChanged(orgID)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *OrganizationsHandler) RemoveMember(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}
	targetUserID := c.Param("userId")
	if targetUserID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user id required"})
		return
	}
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
		return
	}
	if err := h.Services.Organizations.RemoveMember(orgID, targetUserID, userID); err != nil {
		if errors.Is(err, organizations.ErrForbidden) || errors.Is(err, organizations.ErrCannotRemoveOwner) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.broadcastOrgMembersChanged(orgID)
	c.JSON(http.StatusNoContent, nil)
}
