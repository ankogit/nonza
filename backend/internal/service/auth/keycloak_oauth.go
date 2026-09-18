package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"golang.org/x/oauth2"
)

func (s *authService) keycloakIssuer() string {
	return strings.TrimRight(strings.TrimSpace(s.cfg.KeycloakIssuer), "/")
}

func (s *authService) keycloakOAuthConfigured() bool {
	return s.keycloakIssuer() != "" &&
		strings.TrimSpace(s.cfg.KeycloakClientID) != "" &&
		strings.TrimSpace(s.cfg.KeycloakClientSecret) != ""
}

func (s *authService) keycloakOAuthConfig() (*oauth2.Config, error) {
	if !s.keycloakOAuthConfigured() {
		return nil, ErrSocialNotConfigured
	}
	issuer := s.keycloakIssuer()
	redirectURI := strings.TrimSpace(s.cfg.KeycloakRedirectURI)
	if redirectURI == "" {
		base := strings.TrimRight(s.cfg.AuthPublicBaseURL, "/")
		if base == "" {
			return nil, ErrSocialNotConfigured
		}
		redirectURI = base + "/api/v1/auth/keycloak/callback"
	}
	return &oauth2.Config{
		ClientID:     strings.TrimSpace(s.cfg.KeycloakClientID),
		ClientSecret: strings.TrimSpace(s.cfg.KeycloakClientSecret),
		RedirectURL:  redirectURI,
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint: oauth2.Endpoint{
			AuthURL:  issuer + "/protocol/openid-connect/auth",
			TokenURL: issuer + "/protocol/openid-connect/token",
		},
	}, nil
}

func (s *authService) KeycloakAuthURL(returnURL string) (string, error) {
	if err := s.ensureKeycloakAuthEnabled(); err != nil {
		return "", err
	}
	cfg, err := s.keycloakOAuthConfig()
	if err != nil {
		return "", err
	}
	state, err := s.encodeSocialState(returnURL)
	if err != nil {
		return "", err
	}
	return cfg.AuthCodeURL(state, oauth2.AccessTypeOnline), nil
}

func (s *authService) KeycloakCallback(ctx context.Context, code, state string) (redirectURL string, err error) {
	returnURL, err := s.decodeSocialState(state)
	if err != nil {
		return "", err
	}
	cfg, err := s.keycloakOAuthConfig()
	if err != nil {
		return "", err
	}
	token, err := cfg.Exchange(ctx, code)
	if err != nil {
		return "", err
	}
	profile, err := fetchKeycloakUserInfo(ctx, cfg, token)
	if err != nil {
		return "", err
	}
	displayName := strings.TrimSpace(profile.Name)
	if displayName == "" {
		displayName = strings.TrimSpace(profile.PreferredUsername)
	}
	result, err := s.LoginWithKeycloak(profile.Sub, profile.Email, displayName)
	if err != nil {
		return "", err
	}
	return s.FinishSocialLogin(result, returnURL)
}

type keycloakUserInfo struct {
	Sub               string `json:"sub"`
	Email             string `json:"email"`
	Name              string `json:"name"`
	PreferredUsername string `json:"preferred_username"`
}

func fetchKeycloakUserInfo(ctx context.Context, cfg *oauth2.Config, token *oauth2.Token) (*keycloakUserInfo, error) {
	issuer := keycloakIssuerFromOAuthConfig(cfg)
	if issuer == "" {
		return nil, fmt.Errorf("keycloak issuer missing")
	}
	client := cfg.Client(ctx, token)
	userinfoURL := issuer + "/protocol/openid-connect/userinfo"
	resp, err := client.Get(userinfoURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("keycloak userinfo: %s", strings.TrimSpace(string(body)))
	}
	var info keycloakUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, err
	}
	return &info, nil
}

func keycloakIssuerFromOAuthConfig(cfg *oauth2.Config) string {
	if cfg != nil && cfg.Endpoint.TokenURL != "" {
		const suffix = "/protocol/openid-connect/token"
		if strings.HasSuffix(cfg.Endpoint.TokenURL, suffix) {
			return strings.TrimSuffix(cfg.Endpoint.TokenURL, suffix)
		}
	}
	return ""
}
