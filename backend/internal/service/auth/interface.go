package auth

import (
	"time"

	"nonza/backend/internal/models"
)

type AuthResult struct {
	AccessToken      string    `json:"access_token"`
	ExpiresAt        time.Time `json:"expires_at"`
	RefreshToken     string    `json:"refresh_token"`
	RefreshExpiresAt time.Time `json:"refresh_expires_at"`
	User             UserInfo  `json:"user"`
}

type UserInfo struct {
	ID    string  `json:"id"`
	Email string  `json:"email"`
	Name  string  `json:"name,omitempty"`
	Color *string `json:"color,omitempty"`
}

type Auth interface {
	Register(email, password, name string, color *string) (*AuthResult, error)
	Login(email, password string) (*AuthResult, error)
	Refresh(refreshToken string) (*AuthResult, error)
	ParseToken(accessToken string) (userID string, err error)
	UpdateProfile(userID string, name string, color *string) (*models.User, error)
}
