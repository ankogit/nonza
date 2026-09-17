package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type mandarinshowOAuthProfile struct {
	ID       json.Number `json:"id"`
	Email    string      `json:"email"`
	Name     string      `json:"name"`
	Username string      `json:"username"`
}

type mandarinshowOAuthError struct {
	Error string `json:"error"`
}

func (s *authService) mandarinshowOAuthConfigured() bool {
	return strings.TrimSpace(s.cfg.MandarinshowClientID) != "" &&
		strings.TrimSpace(s.cfg.MandarinshowClientSecret) != "" &&
		strings.TrimSpace(s.cfg.MandarinshowAuthorizeURL) != "" &&
		strings.TrimSpace(s.cfg.MandarinshowTokenURL) != "" &&
		strings.TrimSpace(s.mandarinshowRedirectURI()) != ""
}

func (s *authService) mandarinshowRedirectURI() string {
	if u := strings.TrimSpace(s.cfg.MandarinshowRedirectURI); u != "" {
		return u
	}
	base := strings.TrimRight(s.cfg.AuthPublicBaseURL, "/")
	if base == "" {
		return ""
	}
	return base + "/api/v1/auth/mandarinshow/callback"
}

func (s *authService) MandarinshowStartURL(returnURL string) (string, error) {
	if !s.mandarinshowOAuthConfigured() {
		return "", ErrSocialNotConfigured
	}
	state, err := s.encodeSocialState(returnURL)
	if err != nil {
		return "", err
	}
	q := url.Values{}
	q.Set("client_id", strings.TrimSpace(s.cfg.MandarinshowClientID))
	q.Set("redirect_uri", s.mandarinshowRedirectURI())
	q.Set("response_type", "code")
	q.Set("state", state)
	authorizeURL := strings.TrimSpace(s.cfg.MandarinshowAuthorizeURL)
	sep := "?"
	if strings.Contains(authorizeURL, "?") {
		sep = "&"
	}
	return authorizeURL + sep + q.Encode(), nil
}

func (s *authService) MandarinshowCallback(ctx context.Context, code, state, oauthError string) (redirectURL string, err error) {
	returnURL, err := s.decodeSocialState(state)
	if err != nil {
		return "", err
	}
	if oauthError != "" {
		if oauthError == "access_denied" {
			return authAppendQuery(returnURL, "social_error", "access_denied"), nil
		}
		return authAppendQuery(returnURL, "social_error", oauthError), nil
	}
	if code == "" {
		return "", errors.New("authorization code required")
	}
	if !s.mandarinshowOAuthConfigured() {
		return "", ErrSocialNotConfigured
	}
	profile, err := s.exchangeMandarinshowCode(ctx, code)
	if err != nil {
		return "", err
	}
	displayName := strings.TrimSpace(profile.Name)
	if displayName == "" {
		displayName = strings.TrimSpace(profile.Username)
	}
	result, err := s.LoginWithMandarinshow(profile.ID.String(), profile.Email, displayName)
	if err != nil {
		return "", err
	}
	return s.FinishSocialLogin(result, returnURL)
}

func (s *authService) exchangeMandarinshowCode(ctx context.Context, code string) (*mandarinshowOAuthProfile, error) {
	payload := map[string]string{
		"grant_type":    "authorization_code",
		"client_id":     strings.TrimSpace(s.cfg.MandarinshowClientID),
		"client_secret": strings.TrimSpace(s.cfg.MandarinshowClientSecret),
		"code":          strings.TrimSpace(code),
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	tokenURL := strings.TrimSpace(s.cfg.MandarinshowTokenURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		var oauthErr mandarinshowOAuthError
		if json.Unmarshal(raw, &oauthErr) == nil && oauthErr.Error != "" {
			return nil, fmt.Errorf("mandarinshow oauth: %s", oauthErr.Error)
		}
		return nil, fmt.Errorf("mandarinshow oauth: %s", strings.TrimSpace(string(raw)))
	}
	var out mandarinshowOAuthProfile
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	if out.ID.String() == "" || strings.TrimSpace(out.Email) == "" {
		return nil, fmt.Errorf("mandarinshow oauth: incomplete profile")
	}
	return &out, nil
}

func authAppendQuery(rawURL, key, value string) string {
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
