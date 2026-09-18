package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type GoogleOAuthConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
}

func (s *authService) googleOAuthConfig() (*oauth2.Config, error) {
	if s.cfg.GoogleClientID == "" || s.cfg.GoogleClientSecret == "" {
		return nil, ErrSocialNotConfigured
	}
	redirectURI := strings.TrimSpace(s.cfg.GoogleRedirectURI)
	if redirectURI == "" {
		base := strings.TrimRight(s.cfg.AuthPublicBaseURL, "/")
		if base == "" {
			return nil, ErrSocialNotConfigured
		}
		redirectURI = base + "/api/v1/auth/google/callback"
	}
	return &oauth2.Config{
		ClientID:     s.cfg.GoogleClientID,
		ClientSecret: s.cfg.GoogleClientSecret,
		RedirectURL:  redirectURI,
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     google.Endpoint,
	}, nil
}

func (s *authService) GoogleAuthURL(returnURL string) (string, error) {
	if err := s.ensureGoogleAuthEnabled(); err != nil {
		return "", err
	}
	cfg, err := s.googleOAuthConfig()
	if err != nil {
		return "", err
	}
	state, err := s.encodeSocialState(returnURL)
	if err != nil {
		return "", err
	}
	return cfg.AuthCodeURL(state, oauth2.AccessTypeOnline), nil
}

func (s *authService) GoogleCallback(ctx context.Context, code, state string) (redirectURL string, err error) {
	returnURL, err := s.decodeSocialState(state)
	if err != nil {
		return "", err
	}
	cfg, err := s.googleOAuthConfig()
	if err != nil {
		return "", err
	}
	token, err := cfg.Exchange(ctx, code)
	if err != nil {
		return "", err
	}
	profile, err := fetchGoogleUserInfo(ctx, cfg, token)
	if err != nil {
		return "", err
	}
	result, err := s.LoginWithGoogle(profile.Sub, profile.Email, profile.Name)
	if err != nil {
		return "", err
	}
	return s.FinishSocialLogin(result, returnURL)
}

type googleUserInfo struct {
	Sub   string `json:"sub"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

func fetchGoogleUserInfo(ctx context.Context, cfg *oauth2.Config, token *oauth2.Token) (*googleUserInfo, error) {
	client := cfg.Client(ctx, token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v3/userinfo")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("google userinfo: %s", strings.TrimSpace(string(body)))
	}
	var info googleUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, err
	}
	return &info, nil
}

func AppendQueryParam(rawURL, key, value string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		sep := "?"
		if strings.Contains(rawURL, "?") {
			sep = "&"
		}
		return rawURL + sep + url.QueryEscape(key) + "=" + url.QueryEscape(value)
	}
	q := u.Query()
	q.Set(key, value)
	u.RawQuery = q.Encode()
	return u.String()
}
