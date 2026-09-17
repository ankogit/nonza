package oauth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strings"
)

var (
	ErrInvalidClient       = errors.New("invalid_client")
	ErrInvalidGrant        = errors.New("invalid_grant")
	ErrInvalidRequest      = errors.New("invalid_request")
	ErrInvalidScope        = errors.New("invalid_scope")
	ErrUnauthorizedClient  = errors.New("unauthorized_client")
	ErrUnsupportedGrant    = errors.New("unsupported_grant_type")
	ErrUnsupportedResponse = errors.New("unsupported_response_type")
)

var allowedScopes = map[string]struct{}{
	"openid":         {},
	"profile":        {},
	"offline_access": {},
}

func normalizeScope(scope string) string {
	parts := strings.Fields(strings.TrimSpace(scope))
	if len(parts) == 0 {
		return "openid profile"
	}
	seen := make(map[string]struct{}, len(parts))
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if _, ok := allowedScopes[p]; !ok {
			return ""
		}
		if _, ok := seen[p]; ok {
			continue
		}
		seen[p] = struct{}{}
		out = append(out, p)
	}
	sort.Strings(out)
	return strings.Join(out, " ")
}

func scopeAllowedForClient(requested string, allowed []string) bool {
	normalized := normalizeScope(requested)
	if normalized == "" {
		return false
	}
	allowedSet := make(map[string]struct{}, len(allowed))
	for _, s := range allowed {
		allowedSet[s] = struct{}{}
	}
	for _, s := range strings.Fields(normalized) {
		if _, ok := allowedSet[s]; !ok {
			return false
		}
	}
	return true
}

func redirectURIAllowed(clientURIs []string, redirectURI string) bool {
	for _, u := range clientURIs {
		if u == redirectURI {
			return true
		}
	}
	return false
}

func verifyPKCE(codeVerifier, codeChallenge, method string) bool {
	if method == "" {
		method = "S256"
	}
	if method != "S256" {
		return false
	}
	if len(codeVerifier) < 43 || len(codeVerifier) > 128 {
		return false
	}
	sum := sha256.Sum256([]byte(codeVerifier))
	computed := base64.RawURLEncoding.EncodeToString(sum[:])
	return computed == codeChallenge
}

func generateSecureToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func hashRefreshToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func buildRedirectURL(redirectURI, code, state string) (string, error) {
	u, err := url.Parse(redirectURI)
	if err != nil {
		return "", err
	}
	q := u.Query()
	q.Set("code", code)
	if state != "" {
		q.Set("state", state)
	}
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func clientIDPrefix() string {
	return "nz_"
}

func generateClientID() (string, error) {
	token, err := generateSecureToken(16)
	if err != nil {
		return "", err
	}
	return clientIDPrefix() + token, nil
}

func generateClientSecret() (string, error) {
	return generateSecureToken(32)
}

func oauthErrorCode(err error) string {
	switch {
	case errors.Is(err, ErrInvalidClient):
		return "invalid_client"
	case errors.Is(err, ErrInvalidGrant):
		return "invalid_grant"
	case errors.Is(err, ErrInvalidScope):
		return "invalid_scope"
	case errors.Is(err, ErrUnauthorizedClient):
		return "unauthorized_client"
	case errors.Is(err, ErrUnsupportedGrant):
		return "unsupported_grant_type"
	case errors.Is(err, ErrUnsupportedResponse):
		return "unsupported_response_type"
	default:
		return "invalid_request"
	}
}

func OAuthErrorCode(err error) string {
	return oauthErrorCode(err)
}

func appendQuery(base string, params url.Values) (string, error) {
	u, err := url.Parse(base)
	if err != nil {
		return "", fmt.Errorf("invalid oauth ui base url: %w", err)
	}
	q := u.Query()
	for k, values := range params {
		for _, v := range values {
			q.Add(k, v)
		}
	}
	u.RawQuery = q.Encode()
	return u.String(), nil
}
