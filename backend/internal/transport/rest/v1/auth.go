package v1

import (
	"net/http"
	authDto "nonza/backend/internal/dto/auth"
	"nonza/backend/internal/service"
	authService "nonza/backend/internal/service/auth"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	Services *service.Services
}

func NewAuthHandler(services *service.Services) *AuthHandler {
	return &AuthHandler{Services: services}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req authDto.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.Services.Auth.Register(req.Email, req.Password, req.Name, req.Color)
	if err != nil {
		if err == authService.ErrEmailTaken {
			c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
			return
		}
		if err == authService.ErrInvalidColor {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid color format"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"access_token":       result.AccessToken,
		"expires_at":         result.ExpiresAt.Format("2006-01-02T15:04:05Z07:00"),
		"refresh_token":      result.RefreshToken,
		"refresh_expires_at": result.RefreshExpiresAt.Format("2006-01-02T15:04:05Z07:00"),
		"user": gin.H{
			"id":    result.User.ID,
			"email": result.User.Email,
			"name":  result.User.Name,
			"color": result.User.Color,
		},
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req authDto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.Services.Auth.Login(req.Email, req.Password)
	if err != nil {
		if err == authService.ErrInvalidCredentials {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":       result.AccessToken,
		"expires_at":         result.ExpiresAt.Format("2006-01-02T15:04:05Z07:00"),
		"refresh_token":      result.RefreshToken,
		"refresh_expires_at": result.RefreshExpiresAt.Format("2006-01-02T15:04:05Z07:00"),
		"user": gin.H{
			"id":    result.User.ID,
			"email": result.User.Email,
			"name":  result.User.Name,
			"color": result.User.Color,
		},
	})
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "refresh_token required"})
		return
	}
	result, err := h.Services.Auth.Refresh(req.RefreshToken)
	if err != nil {
		if err == authService.ErrInvalidRefreshToken {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired refresh token"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"access_token":       result.AccessToken,
		"expires_at":         result.ExpiresAt.Format("2006-01-02T15:04:05Z07:00"),
		"refresh_token":      result.RefreshToken,
		"refresh_expires_at": result.RefreshExpiresAt.Format("2006-01-02T15:04:05Z07:00"),
		"user": gin.H{
			"id":    result.User.ID,
			"email": result.User.Email,
			"name":  result.User.Name,
			"color": result.User.Color,
		},
	})
}

func (h *AuthHandler) UpdateMe(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
		return
	}
	var req struct {
		Name  string  `json:"name"`
		Color *string `json:"color"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	user, err := h.Services.Auth.UpdateProfile(userID, req.Name, req.Color)
	if err != nil {
		if err == authService.ErrInvalidColor {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid color format"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":    user.ID.String(),
			"email": user.Email,
			"name":  user.Name,
			"color": user.Color,
		},
	})
}
