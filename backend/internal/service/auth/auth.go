package auth

import (
	"errors"
	"regexp"
	"strconv"
	"strings"
	"time"

	"nonza/backend/internal/config"
	"nonza/backend/internal/models"
	"nonza/backend/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const (
	defaultAccessTTL  = 30 * time.Minute
	defaultRefreshTTL = 90 * 24 * time.Hour
)

// parseFlexibleDuration accepts Go durations plus day units ("90d").
func parseFlexibleDuration(s string) (time.Duration, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, errors.New("empty duration")
	}
	if strings.HasSuffix(s, "d") {
		days, err := strconv.ParseFloat(strings.TrimSuffix(s, "d"), 64)
		if err != nil {
			return 0, err
		}
		return time.Duration(days * 24 * float64(time.Hour)), nil
	}
	return time.ParseDuration(s)
}

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrEmailTaken         = errors.New("email already registered")
	ErrInvalidColor       = errors.New("invalid color format")
)

var hexColorRegex = regexp.MustCompile(`^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$`)

func validateColor(c *string) bool {
	if c == nil || *c == "" {
		return true
	}
	return hexColorRegex.MatchString(*c)
}

type authService struct {
	usersRepo repository.Users
	cfg       *config.Config
}

type claims struct {
	UserID   string `json:"user_id"`
	Type     string `json:"type,omitempty"`
	ClientID string `json:"client_id,omitempty"`
	Scope    string `json:"scope,omitempty"`
	jwt.RegisteredClaims
}

func NewAuthService(usersRepo repository.Users, cfg *config.Config) Auth {
	return &authService{usersRepo: usersRepo, cfg: cfg}
}

func (s *authService) Register(email, password, name string, color *string) (*AuthResult, error) {
	_, err := s.usersRepo.GetByEmail(email)
	if err == nil {
		return nil, ErrEmailTaken
	}
	if !validateColor(color) {
		return nil, ErrInvalidColor
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	var userColor *string
	if color != nil && *color != "" {
		userColor = color
	}
	user := &models.User{
		Email:        email,
		PasswordHash: string(hash),
		Name:         strings.TrimSpace(name),
		Color:        userColor,
	}
	if err := s.usersRepo.Create(user); err != nil {
		return nil, err
	}

	return s.issueToken(user)
}

func (s *authService) Login(email, password string) (*AuthResult, error) {
	user, err := s.usersRepo.GetByEmail(email)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if user.PasswordHash == "" {
		return nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	return s.issueToken(user)
}

func (s *authService) issueToken(user *models.User) (*AuthResult, error) {
	accessExp := time.Now().Add(s.accessTTL())
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claims{
		UserID: user.ID.String(),
		Type:   "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(accessExp),
			ID:        uuid.New().String(),
		},
	})

	refreshExp := time.Now().Add(s.refreshTTL())
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claims{
		UserID: user.ID.String(),
		Type:   "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(refreshExp),
			ID:        uuid.New().String(),
		},
	})

	secret := s.jwtSecret()

	signedAccess, err := accessToken.SignedString(secret)
	if err != nil {
		return nil, err
	}
	signedRefresh, err := refreshToken.SignedString(secret)
	if err != nil {
		return nil, err
	}

	return &AuthResult{
		AccessToken:      signedAccess,
		ExpiresAt:        accessExp,
		RefreshToken:     signedRefresh,
		RefreshExpiresAt: refreshExp,
		User: UserInfo{
			ID:    user.ID.String(),
			Email: user.Email,
			Name:  user.Name,
			Color: user.Color,
		},
	}, nil
}

func (s *authService) ParseToken(accessToken string) (userID string, err error) {
	secret := []byte(s.cfg.JWTSecret)
	if len(secret) == 0 {
		secret = []byte("dev-secret-change-in-production")
	}

	tok, err := jwt.ParseWithClaims(accessToken, &claims{}, func(*jwt.Token) (interface{}, error) {
		return secret, nil
	})
	if err != nil || !tok.Valid {
		return "", err
	}

	c, ok := tok.Claims.(*claims)
	if !ok || c.UserID == "" {
		return "", errors.New("invalid token claims")
	}
	if c.Type != "" && c.Type != "access" {
		return "", errors.New("invalid token type")
	}
	return c.UserID, nil
}

var ErrInvalidRefreshToken = errors.New("invalid or expired refresh token")

func (s *authService) Refresh(refreshToken string) (*AuthResult, error) {
	secret := []byte(s.cfg.JWTSecret)
	if len(secret) == 0 {
		secret = []byte("dev-secret-change-in-production")
	}

	tok, err := jwt.ParseWithClaims(refreshToken, &claims{}, func(*jwt.Token) (interface{}, error) {
		return secret, nil
	})
	if err != nil || !tok.Valid {
		return nil, ErrInvalidRefreshToken
	}

	c, ok := tok.Claims.(*claims)
	if !ok || c.UserID == "" || c.Type != "refresh" {
		return nil, ErrInvalidRefreshToken
	}

	userID, err := uuid.Parse(c.UserID)
	if err != nil {
		return nil, ErrInvalidRefreshToken
	}
	user, err := s.usersRepo.GetByID(userID)
	if err != nil {
		return nil, ErrInvalidRefreshToken
	}

	return s.issueToken(user)
}

func (s *authService) UpdateProfile(userID string, name string, color *string) (*models.User, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, err
	}
	user, err := s.usersRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	user.Name = name
	if color != nil {
		if !validateColor(color) {
			return nil, ErrInvalidColor
		}
		if *color == "" {
			user.Color = nil
		} else {
			user.Color = color
		}
	}
	if err := s.usersRepo.Update(user); err != nil {
		return nil, err
	}
	return user, nil
}

func (s *authService) jwtSecret() []byte {
	secret := []byte(s.cfg.JWTSecret)
	if len(secret) == 0 {
		secret = []byte("dev-secret-change-in-production")
	}
	return secret
}

func (s *authService) accessTTL() time.Duration {
	if s.cfg.JWTAccessTokenTTL != "" {
		if d, err := parseFlexibleDuration(s.cfg.JWTAccessTokenTTL); err == nil && d > 0 {
			return d
		}
	}
	return defaultAccessTTL
}

func (s *authService) refreshTTL() time.Duration {
	if s.cfg.JWTRefreshTokenTTL != "" {
		if d, err := parseFlexibleDuration(s.cfg.JWTRefreshTokenTTL); err == nil && d > 0 {
			return d
		}
	}
	return defaultRefreshTTL
}

func (s *authService) IssueOAuthTokens(userID, clientID, scope string) (*OAuthTokenPair, error) {
	accessExp := time.Now().Add(s.accessTTL())
	refreshExp := time.Now().Add(s.refreshTTL())
	refreshJTI := uuid.New().String()

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claims{
		UserID:   userID,
		Type:     "access",
		ClientID: clientID,
		Scope:    scope,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(accessExp),
			Audience:  jwt.ClaimStrings{clientID},
			ID:        uuid.New().String(),
		},
	})

	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claims{
		UserID:   userID,
		Type:     "refresh",
		ClientID: clientID,
		Scope:    scope,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(refreshExp),
			Audience:  jwt.ClaimStrings{clientID},
			ID:        refreshJTI,
		},
	})

	secret := s.jwtSecret()
	signedAccess, err := accessToken.SignedString(secret)
	if err != nil {
		return nil, err
	}
	signedRefresh, err := refreshToken.SignedString(secret)
	if err != nil {
		return nil, err
	}

	return &OAuthTokenPair{
		AccessToken:      signedAccess,
		AccessExpiresAt:  accessExp,
		RefreshToken:     signedRefresh,
		RefreshExpiresAt: refreshExp,
		RefreshJTI:       refreshJTI,
	}, nil
}

func (s *authService) ParseOAuthRefreshToken(refreshToken string) (*RefreshTokenClaims, error) {
	tok, err := jwt.ParseWithClaims(refreshToken, &claims{}, func(*jwt.Token) (interface{}, error) {
		return s.jwtSecret(), nil
	})
	if err != nil || !tok.Valid {
		return nil, ErrInvalidRefreshToken
	}

	c, ok := tok.Claims.(*claims)
	if !ok || c.UserID == "" || c.Type != "refresh" || c.ClientID == "" {
		return nil, ErrInvalidRefreshToken
	}
	if c.ID == "" {
		return nil, ErrInvalidRefreshToken
	}

	return &RefreshTokenClaims{
		UserID:   c.UserID,
		ClientID: c.ClientID,
		JTI:      c.ID,
	}, nil
}
