package v1

import (
	"log"
	"net/http"
	orgDto "nonza/backend/internal/dto/organizations"
	"nonza/backend/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type OrganizationsHandler struct {
	Services *service.Services
}

func NewOrganizationsHandler(services *service.Services) *OrganizationsHandler {
	return &OrganizationsHandler{Services: services}
}

func (h *OrganizationsHandler) Create(c *gin.Context) {
	log.Printf("[OrganizationsHandler] POST /api/v1/organizations - received request from %s", c.ClientIP())
	
	var req orgDto.CreateOrganizationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[OrganizationsHandler] Failed to bind JSON: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log.Printf("[OrganizationsHandler] Creating organization: name=%s, description=%s", req.Name, req.Description)
	org, err := h.Services.Organizations.Create(req.Name, req.Description)
	if err != nil {
		log.Printf("[OrganizationsHandler] Failed to create organization: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	log.Printf("[OrganizationsHandler] Successfully created organization: id=%s", org.ID)
	c.JSON(http.StatusCreated, orgDto.ToOrganizationResponse(org))
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

	org, err := h.Services.Organizations.Update(id, req.Name, req.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, orgDto.ToOrganizationResponse(org))
}

func (h *OrganizationsHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := h.Services.Organizations.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
