package auth

import "time"

type OAuthTokenPair struct {
	AccessToken      string
	AccessExpiresAt  time.Time
	RefreshToken     string
	RefreshExpiresAt time.Time
	RefreshJTI       string
}

type RefreshTokenClaims struct {
	UserID   string
	ClientID string
	JTI      string
}
