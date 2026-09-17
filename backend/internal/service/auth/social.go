package auth

import (
	"errors"
	"strings"
	"time"

	"nonza/backend/internal/models"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrSocialNotConfigured = errors.New("social login not configured")
	ErrInvalidSocialTicket = errors.New("invalid or expired social login ticket")
	ErrSocialEmailRequired = errors.New("email required for social login")
)

type socialStateClaims struct {
	ReturnURL string `json:"return_url"`
	jwt.RegisteredClaims
}

type socialTicketClaims struct {
	UserID string `json:"user_id"`
	Type   string `json:"type"`
	jwt.RegisteredClaims
}

func (s *authService) encodeSocialState(returnURL string) (string, error) {
	if returnURL == "" {
		return "", errors.New("return_url required")
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, socialStateClaims{
		ReturnURL: returnURL,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			ID:        uuid.New().String(),
		},
	})
	return token.SignedString(s.jwtSecret())
}

func (s *authService) decodeSocialState(state string) (string, error) {
	if state == "" {
		return "", errors.New("missing state")
	}
	var claims socialStateClaims
	_, err := jwt.ParseWithClaims(state, &claims, func(t *jwt.Token) (interface{}, error) {
		return s.jwtSecret(), nil
	})
	if err != nil {
		return "", err
	}
	if claims.ReturnURL == "" {
		return "", errors.New("invalid state")
	}
	return claims.ReturnURL, nil
}

func (s *authService) IssueSocialLoginTicket(userID string) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, socialTicketClaims{
		UserID: userID,
		Type:   "social_login",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(3 * time.Minute)),
			ID:        uuid.New().String(),
		},
	})
	return token.SignedString(s.jwtSecret())
}

func (s *authService) RedeemSocialLoginTicket(ticket string) (*AuthResult, error) {
	var claims socialTicketClaims
	_, err := jwt.ParseWithClaims(ticket, &claims, func(t *jwt.Token) (interface{}, error) {
		return s.jwtSecret(), nil
	})
	if err != nil || claims.Type != "social_login" || claims.UserID == "" {
		return nil, ErrInvalidSocialTicket
	}
	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		return nil, ErrInvalidSocialTicket
	}
	user, err := s.usersRepo.GetByID(userID)
	if err != nil {
		return nil, ErrInvalidSocialTicket
	}
	return s.issueToken(user)
}

func (s *authService) LoginWithGoogle(googleSub, email, name string) (*AuthResult, error) {
	googleSub = strings.TrimSpace(googleSub)
	email = strings.TrimSpace(strings.ToLower(email))
	name = strings.TrimSpace(name)
	if googleSub == "" {
		return nil, errors.New("google id required")
	}
	if email == "" {
		return nil, ErrSocialEmailRequired
	}

	user, err := s.usersRepo.GetByGoogleID(googleSub)
	if err == nil {
		return s.issueToken(user)
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	byEmail, err := s.usersRepo.GetByEmail(email)
	if err == nil {
		byEmail.GoogleID = &googleSub
		if name != "" && byEmail.Name == "" {
			byEmail.Name = name
		}
		if err := s.usersRepo.Update(byEmail); err != nil {
			return nil, err
		}
		return s.issueToken(byEmail)
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	gid := googleSub
	user = &models.User{
		Email:      email,
		Name:       name,
		GoogleID:   &gid,
		PasswordHash: "",
	}
	if user.Name == "" {
		user.Name = strings.Split(email, "@")[0]
	}
	if err := s.usersRepo.Create(user); err != nil {
		return nil, err
	}
	return s.issueToken(user)
}

func (s *authService) LoginWithMandarinshow(msUserID, email, name string) (*AuthResult, error) {
	msUserID = strings.TrimSpace(msUserID)
	email = strings.TrimSpace(strings.ToLower(email))
	name = strings.TrimSpace(name)
	if msUserID == "" {
		return nil, errors.New("mandarinshow user id required")
	}
	if email == "" {
		return nil, ErrSocialEmailRequired
	}

	user, err := s.usersRepo.GetByMandarinshowUserID(msUserID)
	if err == nil {
		return s.issueToken(user)
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	byEmail, err := s.usersRepo.GetByEmail(email)
	if err == nil {
		msid := msUserID
		byEmail.MandarinshowUserID = &msid
		if name != "" && byEmail.Name == "" {
			byEmail.Name = name
		}
		if err := s.usersRepo.Update(byEmail); err != nil {
			return nil, err
		}
		return s.issueToken(byEmail)
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	msid := msUserID
	user = &models.User{
		Email:              email,
		Name:               name,
		MandarinshowUserID: &msid,
		PasswordHash:       "",
	}
	if user.Name == "" {
		user.Name = strings.Split(email, "@")[0]
	}
	if err := s.usersRepo.Create(user); err != nil {
		return nil, err
	}
	return s.issueToken(user)
}

func (s *authService) FinishSocialLogin(result *AuthResult, returnURL string) (string, error) {
	ticket, err := s.IssueSocialLoginTicket(result.User.ID)
	if err != nil {
		return "", err
	}
	sep := "?"
	if strings.Contains(returnURL, "?") {
		sep = "&"
	}
	return returnURL + sep + "social_ticket=" + ticket, nil
}
