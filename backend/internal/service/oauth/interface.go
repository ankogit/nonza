package oauth

import (
	"time"

	"nonza/backend/internal/models"
)

type AuthorizeParams struct {
	ClientID            string
	RedirectURI         string
	ResponseType        string
	State               string
	Scope               string
	CodeChallenge       string
	CodeChallengeMethod string
}

type AuthorizeInfo struct {
	ClientID    string   `json:"client_id"`
	Name        string   `json:"name"`
	Trusted     bool     `json:"trusted"`
	Scopes      []string `json:"scopes"`
	RedirectURI string   `json:"redirect_uri"`
	State       string   `json:"state"`
}

type ApproveParams struct {
	UserID              string
	ClientID            string
	RedirectURI         string
	State               string
	Scope               string
	CodeChallenge       string
	CodeChallengeMethod string
}

type ApproveResult struct {
	RedirectURL string `json:"redirect_url"`
}

type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int64  `json:"expires_in"`
	RefreshToken string `json:"refresh_token,omitempty"`
	Scope        string `json:"scope"`
}

type UserInfo struct {
	Sub   string  `json:"sub"`
	Email string  `json:"email,omitempty"`
	Name  string  `json:"name,omitempty"`
	Color *string `json:"color,omitempty"`
}

type CreateClientParams struct {
	Name           string
	RedirectURIs   []string
	Scopes         []string
	ClientType     string
	Trusted        bool
	OrganizationID *string
}

type CreateClientResult struct {
	ID             string    `json:"id"`
	ClientID       string    `json:"client_id"`
	ClientSecret   string    `json:"client_secret,omitempty"`
	Name           string    `json:"name"`
	RedirectURIs   []string  `json:"redirect_uris"`
	Scopes         []string  `json:"scopes"`
	ClientType     string    `json:"client_type"`
	Trusted        bool      `json:"trusted"`
	Active         bool      `json:"active"`
	OrganizationID *string   `json:"organization_id,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

type OAuth interface {
	ValidateAuthorizeParams(params AuthorizeParams) error
	GetAuthorizeInfo(params AuthorizeParams) (*AuthorizeInfo, error)
	Approve(params ApproveParams) (*ApproveResult, error)
	ExchangeAuthorizationCode(clientID, clientSecret, code, redirectURI, codeVerifier string) (*TokenResponse, error)
	RefreshToken(clientID, clientSecret, refreshToken string) (*TokenResponse, error)
	RevokeRefreshToken(clientID, clientSecret, refreshToken string) error
	GetUserInfo(accessToken string) (*UserInfo, error)
	CreateClient(params CreateClientParams) (*CreateClientResult, error)
	DeactivateClient(clientID string) error
	ListClients() ([]CreateClientResult, error)
	AuthorizeUIURL(params AuthorizeParams) (string, error)
	AuthenticateConfidentialClient(clientID, clientSecret string) (*models.OAuthClient, error)
}
