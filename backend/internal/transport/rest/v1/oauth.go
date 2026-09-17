package v1

import (
	"errors"
	"net/http"
	"strings"

	"nonza/backend/internal/service"
	oauthService "nonza/backend/internal/service/oauth"

	"github.com/gin-gonic/gin"
)

type OAuthHandler struct {
	Services *service.Services
}

func NewOAuthHandler(services *service.Services) *OAuthHandler {
	return &OAuthHandler{Services: services}
}

func (h *OAuthHandler) AuthorizeInfo(c *gin.Context) {
	params := oauthService.AuthorizeParams{
		ClientID:            c.Query("client_id"),
		RedirectURI:         c.Query("redirect_uri"),
		ResponseType:        c.Query("response_type"),
		State:               c.Query("state"),
		Scope:               c.Query("scope"),
		CodeChallenge:       c.Query("code_challenge"),
		CodeChallengeMethod: c.Query("code_challenge_method"),
	}
	info, err := h.Services.OAuth.GetAuthorizeInfo(params)
	if err != nil {
		h.writeOAuthError(c, http.StatusBadRequest, err)
		return
	}
	c.JSON(http.StatusOK, info)
}

func (h *OAuthHandler) Approve(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
		return
	}

	var req struct {
		ClientID            string `json:"client_id" binding:"required"`
		RedirectURI         string `json:"redirect_uri" binding:"required"`
		State               string `json:"state" binding:"required"`
		Scope               string `json:"scope"`
		CodeChallenge       string `json:"code_challenge"`
		CodeChallengeMethod string `json:"code_challenge_method"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.Services.OAuth.Approve(oauthService.ApproveParams{
		UserID:              userID,
		ClientID:            req.ClientID,
		RedirectURI:         req.RedirectURI,
		State:               req.State,
		Scope:               req.Scope,
		CodeChallenge:       req.CodeChallenge,
		CodeChallengeMethod: req.CodeChallengeMethod,
	})
	if err != nil {
		h.writeOAuthError(c, http.StatusBadRequest, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *OAuthHandler) AuthorizeRedirect(c *gin.Context) {
	params := oauthService.AuthorizeParams{
		ClientID:            c.Query("client_id"),
		RedirectURI:         c.Query("redirect_uri"),
		ResponseType:        c.Query("response_type"),
		State:               c.Query("state"),
		Scope:               c.Query("scope"),
		CodeChallenge:       c.Query("code_challenge"),
		CodeChallengeMethod: c.Query("code_challenge_method"),
	}
	uiURL, err := h.Services.OAuth.AuthorizeUIURL(params)
	if err != nil {
		h.writeOAuthError(c, http.StatusBadRequest, err)
		return
	}
	c.Redirect(http.StatusFound, uiURL)
}

func (h *OAuthHandler) Token(c *gin.Context) {
	grantType := c.PostForm("grant_type")
	clientID, clientSecret := parseClientCredentials(c)

	switch grantType {
	case "authorization_code":
		h.exchangeAuthorizationCode(c, clientID, clientSecret)
	case "refresh_token":
		h.refreshToken(c, clientID, clientSecret)
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"error":             "unsupported_grant_type",
			"error_description": "unsupported grant_type",
		})
	}
}

func (h *OAuthHandler) Revoke(c *gin.Context) {
	clientID, clientSecret := parseClientCredentials(c)
	refreshToken := c.PostForm("token")
	if refreshToken == "" {
		c.Status(http.StatusOK)
		return
	}
	_ = h.Services.OAuth.RevokeRefreshToken(clientID, clientSecret, refreshToken)
	c.Status(http.StatusOK)
}

func (h *OAuthHandler) UserInfo(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_token"})
		return
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_token"})
		return
	}
	info, err := h.Services.OAuth.GetUserInfo(parts[1])
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_token"})
		return
	}
	c.JSON(http.StatusOK, info)
}

func (h *OAuthHandler) exchangeAuthorizationCode(c *gin.Context, clientID, clientSecret string) {
	code := c.PostForm("code")
	redirectURI := c.PostForm("redirect_uri")
	codeVerifier := c.PostForm("code_verifier")
	if clientID == "" {
		clientID = c.PostForm("client_id")
	}

	result, err := h.Services.OAuth.ExchangeAuthorizationCode(clientID, clientSecret, code, redirectURI, codeVerifier)
	if err != nil {
		h.writeOAuthTokenError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *OAuthHandler) refreshToken(c *gin.Context, clientID, clientSecret string) {
	refreshToken := c.PostForm("refresh_token")
	if clientID == "" {
		clientID = c.PostForm("client_id")
	}
	result, err := h.Services.OAuth.RefreshToken(clientID, clientSecret, refreshToken)
	if err != nil {
		h.writeOAuthTokenError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func parseClientCredentials(c *gin.Context) (clientID, clientSecret string) {
	if header := c.GetHeader("Authorization"); strings.HasPrefix(strings.ToLower(header), "basic ") {
		user, pass, ok := c.Request.BasicAuth()
		if ok {
			return user, pass
		}
	}
	return c.PostForm("client_id"), c.PostForm("client_secret")
}

func (h *OAuthHandler) writeOAuthError(c *gin.Context, status int, err error) {
	c.JSON(status, gin.H{
		"error":             oauthService.OAuthErrorCode(err),
		"error_description": err.Error(),
	})
}

func (h *OAuthHandler) writeOAuthTokenError(c *gin.Context, err error) {
	status := http.StatusBadRequest
	if errors.Is(err, oauthService.ErrInvalidClient) || errors.Is(err, oauthService.ErrUnauthorizedClient) {
		status = http.StatusUnauthorized
	}
	c.JSON(status, gin.H{
		"error":             oauthService.OAuthErrorCode(err),
		"error_description": err.Error(),
	})
}
