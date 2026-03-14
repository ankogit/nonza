package v1

import (
	"net/http"
	"time"

	inviteDto "nonza/backend/internal/dto/invites"
	"nonza/backend/internal/pkg/orgroles"
	"nonza/backend/internal/service"
	invitesService "nonza/backend/internal/service/invites"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type InvitesHandler struct {
	Services *service.Services
}

func NewInvitesHandler(services *service.Services) *InvitesHandler {
	return &InvitesHandler{Services: services}
}

func (h *InvitesHandler) Create(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}
	var req inviteDto.CreateInviteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	role := req.Role
	if role == "" {
		role = "member"
	}
	expiresIn := 7 * 24 * time.Hour
	if req.ExpiresIn != "" {
		if d, err := time.ParseDuration(req.ExpiresIn); err == nil {
			expiresIn = d
		}
	}
	inviterID := c.GetString("user_id")
	if inviterID == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "unauthorized"})
		return
	}
	ok, err := h.Services.Organizations.UserHasPermission(orgID, inviterID, orgroles.PermissionInvite)
	if err != nil || !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "no permission to invite"})
		return
	}
	inv, err := h.Services.Invites.Create(orgID, inviterID, role, expiresIn)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	inv.Organization.ID = inv.OrganizationID
	if org, _ := h.Services.Organizations.GetByID(orgID); org != nil {
		inv.Organization.Name = org.Name
	}
	c.JSON(http.StatusCreated, inviteDto.ToInviteResponse(inv))
}

func (h *InvitesHandler) GetByToken(c *gin.Context) {
	token := c.Param("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token required"})
		return
	}
	inv, err := h.Services.Invites.GetByToken(token)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "invite not found"})
		return
	}
	if time.Now().After(inv.ExpiresAt) {
		c.JSON(http.StatusGone, gin.H{"error": "invite expired"})
		return
	}
	c.JSON(http.StatusOK, inviteDto.ToInviteResponse(inv))
}

func (h *InvitesHandler) Accept(c *gin.Context) {
	token := c.Param("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token required"})
		return
	}
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required to accept invite"})
		return
	}
	var req struct {
		Color *string `json:"color"`
	}
	_ = c.ShouldBindJSON(&req)
	err := h.Services.Invites.Accept(token, userID, req.Color)
	if err != nil {
		if err == invitesService.ErrInviteExpired {
			c.JSON(http.StatusGone, gin.H{"error": "invite expired"})
			return
		}
		if err == invitesService.ErrAlreadyMember {
			c.JSON(http.StatusOK, gin.H{"status": "already_member"})
			return
		}
		if err == invitesService.ErrInvalidColor {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid color format"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "accepted"})
}
