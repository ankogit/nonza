package v1

import (
	"net/http"
	"strings"

	"nonza/backend/internal/service"
	authService "nonza/backend/internal/service/auth"

	"github.com/gin-gonic/gin"
)

type AuthSocialHandler struct {
	Services *service.Services
}

func NewAuthSocialHandler(services *service.Services) *AuthSocialHandler {
	return &AuthSocialHandler{Services: services}
}

func (h *AuthSocialHandler) GoogleStart(c *gin.Context) {
	returnURL := strings.TrimSpace(c.Query("return_url"))
	if returnURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "return_url required"})
		return
	}
	url, err := h.Services.Auth.GoogleAuthURL(returnURL)
	if err != nil {
		h.writeSocialConfigError(c, err)
		return
	}
	c.Redirect(http.StatusFound, url)
}

func (h *AuthSocialHandler) GoogleCallback(c *gin.Context) {
	code := strings.TrimSpace(c.Query("code"))
	state := strings.TrimSpace(c.Query("state"))
	if code == "" || state == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "code and state required"})
		return
	}
	redirectURL, err := h.Services.Auth.GoogleCallback(c.Request.Context(), code, state)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.Redirect(http.StatusFound, redirectURL)
}

func (h *AuthSocialHandler) MandarinshowStart(c *gin.Context) {
	returnURL := strings.TrimSpace(c.Query("return_url"))
	if returnURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "return_url required"})
		return
	}
	url, err := h.Services.Auth.MandarinshowStartURL(returnURL)
	if err != nil {
		h.writeSocialConfigError(c, err)
		return
	}
	c.Redirect(http.StatusFound, url)
}

func (h *AuthSocialHandler) MandarinshowCallback(c *gin.Context) {
	oauthErr := strings.TrimSpace(c.Query("error"))
	code := strings.TrimSpace(c.Query("code"))
	state := strings.TrimSpace(c.Query("state"))
	if state == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "state required"})
		return
	}
	if oauthErr == "" && code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "code or error required"})
		return
	}
	redirectURL, err := h.Services.Auth.MandarinshowCallback(c.Request.Context(), code, state, oauthErr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.Redirect(http.StatusFound, redirectURL)
}

func (h *AuthSocialHandler) SocialExchange(c *gin.Context) {
	var req struct {
		Ticket string `json:"ticket" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ticket required"})
		return
	}
	result, err := h.Services.Auth.RedeemSocialLoginTicket(strings.TrimSpace(req.Ticket))
	if err != nil {
		if err == authService.ErrInvalidSocialTicket {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired ticket"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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

func (h *AuthSocialHandler) writeSocialConfigError(c *gin.Context, err error) {
	if err == authService.ErrSocialNotConfigured {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "social login is not configured"})
		return
	}
	c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
}
