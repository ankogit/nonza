package oauth

import (
	"net/url"
	"strings"
	"time"

	"nonza/backend/internal/config"
	"nonza/backend/internal/models"
	"nonza/backend/internal/repository"
	authService "nonza/backend/internal/service/auth"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const authorizationCodeTTL = 10 * time.Minute

type oauthService struct {
	clientsRepo  repository.OAuthClients
	codesRepo    repository.OAuthCodes
	refreshRepo  repository.OAuthRefreshTokens
	usersRepo    repository.Users
	auth         authService.Auth
	cfg          *config.Config
}

func NewOAuthService(
	clientsRepo repository.OAuthClients,
	codesRepo repository.OAuthCodes,
	refreshRepo repository.OAuthRefreshTokens,
	usersRepo repository.Users,
	auth authService.Auth,
	cfg *config.Config,
) OAuth {
	return &oauthService{
		clientsRepo: clientsRepo,
		codesRepo:   codesRepo,
		refreshRepo: refreshRepo,
		usersRepo:   usersRepo,
		auth:        auth,
		cfg:         cfg,
	}
}

func (s *oauthService) getActiveClient(clientID string) (*models.OAuthClient, error) {
	client, err := s.clientsRepo.GetByClientID(clientID)
	if err != nil || !client.Active {
		return nil, ErrInvalidClient
	}
	return client, nil
}

func (s *oauthService) verifyClientSecret(client *models.OAuthClient, secret string) error {
	if client.ClientType == models.OAuthClientTypePublic {
		if secret != "" {
			return ErrInvalidClient
		}
		return nil
	}
	if secret == "" || client.ClientSecretHash == "" {
		return ErrInvalidClient
	}
	if err := bcrypt.CompareHashAndPassword([]byte(client.ClientSecretHash), []byte(secret)); err != nil {
		return ErrInvalidClient
	}
	return nil
}

func (s *oauthService) validateAuthorizeParamsInternal(params AuthorizeParams, client *models.OAuthClient) (string, error) {
	if params.ResponseType != "" && params.ResponseType != "code" {
		return "", ErrUnsupportedResponse
	}
	if params.State == "" {
		return "", ErrInvalidRequest
	}
	if !redirectURIAllowed(client.RedirectURIs, params.RedirectURI) {
		return "", ErrInvalidRequest
	}

	scope := normalizeScope(params.Scope)
	if scope == "" {
		return "", ErrInvalidScope
	}
	if !scopeAllowedForClient(scope, client.Scopes) {
		return "", ErrInvalidScope
	}

	if client.ClientType == models.OAuthClientTypePublic {
		if params.CodeChallenge == "" || params.CodeChallengeMethod != "S256" {
			return "", ErrInvalidRequest
		}
	} else if params.CodeChallenge != "" && params.CodeChallengeMethod != "S256" {
		return "", ErrInvalidRequest
	}

	return scope, nil
}

func (s *oauthService) ValidateAuthorizeParams(params AuthorizeParams) error {
	client, err := s.getActiveClient(params.ClientID)
	if err != nil {
		return err
	}
	_, err = s.validateAuthorizeParamsInternal(params, client)
	return err
}

func (s *oauthService) GetAuthorizeInfo(params AuthorizeParams) (*AuthorizeInfo, error) {
	client, err := s.getActiveClient(params.ClientID)
	if err != nil {
		return nil, err
	}
	scope, err := s.validateAuthorizeParamsInternal(params, client)
	if err != nil {
		return nil, err
	}
	return &AuthorizeInfo{
		ClientID:    client.ClientID,
		Name:        client.Name,
		Trusted:     client.Trusted,
		Scopes:      strings.Fields(scope),
		RedirectURI: params.RedirectURI,
		State:       params.State,
	}, nil
}

func (s *oauthService) Approve(params ApproveParams) (*ApproveResult, error) {
	client, err := s.getActiveClient(params.ClientID)
	if err != nil {
		return nil, err
	}

	authParams := AuthorizeParams{
		ClientID:            params.ClientID,
		RedirectURI:         params.RedirectURI,
		ResponseType:        "code",
		State:               params.State,
		Scope:               params.Scope,
		CodeChallenge:       params.CodeChallenge,
		CodeChallengeMethod: params.CodeChallengeMethod,
	}
	scope, err := s.validateAuthorizeParamsInternal(authParams, client)
	if err != nil {
		return nil, err
	}

	userID, err := uuid.Parse(params.UserID)
	if err != nil {
		return nil, ErrInvalidRequest
	}
	if _, err := s.usersRepo.GetByID(userID); err != nil {
		return nil, ErrInvalidGrant
	}

	codeValue, err := generateSecureToken(32)
	if err != nil {
		return nil, err
	}

	challenge := params.CodeChallenge
	method := params.CodeChallengeMethod
	if method == "" {
		method = "S256"
	}

	code := &models.OAuthAuthorizationCode{
		Code:                codeValue,
		ClientID:            client.ClientID,
		UserID:              userID,
		RedirectURI:         params.RedirectURI,
		Scope:               scope,
		CodeChallenge:       challenge,
		CodeChallengeMethod: method,
		ExpiresAt:           time.Now().Add(authorizationCodeTTL),
	}
	if err := s.codesRepo.Create(code); err != nil {
		return nil, err
	}

	redirectURL, err := buildRedirectURL(params.RedirectURI, codeValue, params.State)
	if err != nil {
		return nil, err
	}
	return &ApproveResult{RedirectURL: redirectURL}, nil
}

func (s *oauthService) ExchangeAuthorizationCode(clientID, clientSecret, code, redirectURI, codeVerifier string) (*TokenResponse, error) {
	client, err := s.getActiveClient(clientID)
	if err != nil {
		return nil, err
	}
	if err := s.verifyClientSecret(client, clientSecret); err != nil {
		return nil, err
	}

	authCode, err := s.codesRepo.GetByCode(code)
	if err != nil {
		return nil, ErrInvalidGrant
	}
	if authCode.ClientID != client.ClientID {
		return nil, ErrInvalidGrant
	}
	if authCode.UsedAt != nil {
		return nil, ErrInvalidGrant
	}
	if time.Now().After(authCode.ExpiresAt) {
		return nil, ErrInvalidGrant
	}
	if authCode.RedirectURI != redirectURI {
		return nil, ErrInvalidGrant
	}
	if authCode.CodeChallenge != "" {
		if !verifyPKCE(codeVerifier, authCode.CodeChallenge, authCode.CodeChallengeMethod) {
			return nil, ErrInvalidGrant
		}
	} else if client.ClientType == models.OAuthClientTypePublic {
		return nil, ErrInvalidGrant
	}

	if err := s.codesRepo.MarkUsed(authCode.ID.String()); err != nil {
		return nil, ErrInvalidGrant
	}

	return s.issueTokens(client, authCode.UserID.String(), authCode.Scope)
}

func (s *oauthService) RefreshToken(clientID, clientSecret, refreshToken string) (*TokenResponse, error) {
	client, err := s.getActiveClient(clientID)
	if err != nil {
		return nil, err
	}
	if err := s.verifyClientSecret(client, clientSecret); err != nil {
		return nil, err
	}

	claims, err := s.auth.ParseOAuthRefreshToken(refreshToken)
	if err != nil {
		return nil, ErrInvalidGrant
	}
	if claims.ClientID != client.ClientID {
		return nil, ErrInvalidGrant
	}

	stored, err := s.refreshRepo.GetByJTI(claims.JTI)
	if err != nil {
		return nil, ErrInvalidGrant
	}
	if stored.RevokedAt != nil || time.Now().After(stored.ExpiresAt) {
		return nil, ErrInvalidGrant
	}
	if hashRefreshToken(refreshToken) != stored.TokenHash {
		return nil, ErrInvalidGrant
	}

	if err := s.refreshRepo.RevokeByJTI(claims.JTI); err != nil {
		return nil, err
	}

	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		return nil, ErrInvalidGrant
	}
	if _, err := s.usersRepo.GetByID(userID); err != nil {
		return nil, ErrInvalidGrant
	}

	return s.issueTokens(client, claims.UserID, stored.Scope)
}

func (s *oauthService) RevokeRefreshToken(clientID, clientSecret, refreshToken string) error {
	client, err := s.getActiveClient(clientID)
	if err != nil {
		return err
	}
	if err := s.verifyClientSecret(client, clientSecret); err != nil {
		return err
	}

	claims, err := s.auth.ParseOAuthRefreshToken(refreshToken)
	if err != nil {
		return nil
	}
	if claims.ClientID != client.ClientID {
		return nil
	}
	_ = s.refreshRepo.RevokeByJTI(claims.JTI)
	return nil
}

func (s *oauthService) issueTokens(client *models.OAuthClient, userID, scope string) (*TokenResponse, error) {
	includeRefresh := strings.Contains(scope, "offline_access")

	pair, err := s.auth.IssueOAuthTokens(userID, client.ClientID, scope)
	if err != nil {
		return nil, err
	}

	resp := &TokenResponse{
		AccessToken: pair.AccessToken,
		TokenType:   "Bearer",
		ExpiresIn:   int64(time.Until(pair.AccessExpiresAt).Seconds()),
		Scope:       scope,
	}

	if includeRefresh {
		resp.RefreshToken = pair.RefreshToken
		if err := s.refreshRepo.Create(&models.OAuthRefreshToken{
			TokenHash: hashRefreshToken(pair.RefreshToken),
			JTI:       pair.RefreshJTI,
			ClientID:  client.ClientID,
			UserID:    uuid.MustParse(userID),
			Scope:     scope,
			ExpiresAt: pair.RefreshExpiresAt,
		}); err != nil {
			return nil, err
		}
	}

	return resp, nil
}

func (s *oauthService) GetUserInfo(accessToken string) (*UserInfo, error) {
	userID, err := s.auth.ParseToken(accessToken)
	if err != nil {
		return nil, ErrInvalidGrant
	}
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, ErrInvalidGrant
	}
	user, err := s.usersRepo.GetByID(id)
	if err != nil {
		return nil, ErrInvalidGrant
	}
	return &UserInfo{
		Sub:   user.ID.String(),
		Email: user.Email,
		Name:  user.Name,
		Color: user.Color,
	}, nil
}

func (s *oauthService) CreateClient(params CreateClientParams) (*CreateClientResult, error) {
	clientType := params.ClientType
	if clientType == "" {
		clientType = models.OAuthClientTypeConfidential
	}
	if clientType != models.OAuthClientTypeConfidential && clientType != models.OAuthClientTypePublic {
		return nil, ErrInvalidRequest
	}
	if len(params.RedirectURIs) == 0 {
		return nil, ErrInvalidRequest
	}

	scopes := params.Scopes
	if len(scopes) == 0 {
		scopes = []string{"openid", "profile", "offline_access"}
	}
	for _, sc := range scopes {
		if _, ok := allowedScopes[sc]; !ok {
			return nil, ErrInvalidScope
		}
	}

	clientID, err := generateClientID()
	if err != nil {
		return nil, err
	}

	var secretPlain string
	var secretHash string
	if clientType == models.OAuthClientTypeConfidential {
		secretPlain, err = generateClientSecret()
		if err != nil {
			return nil, err
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(secretPlain), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		secretHash = string(hash)
	}

	var orgID *uuid.UUID
	if params.OrganizationID != nil && strings.TrimSpace(*params.OrganizationID) != "" {
		parsed, err := uuid.Parse(strings.TrimSpace(*params.OrganizationID))
		if err != nil {
			return nil, ErrInvalidRequest
		}
		orgID = &parsed
	}

	client := &models.OAuthClient{
		ClientID:         clientID,
		ClientSecretHash: secretHash,
		Name:             strings.TrimSpace(params.Name),
		RedirectURIs:     models.StringSlice(params.RedirectURIs),
		Scopes:           models.StringSlice(scopes),
		ClientType:       clientType,
		Trusted:          params.Trusted,
		Active:           true,
		OrganizationID:   orgID,
	}
	if client.Name == "" {
		return nil, ErrInvalidRequest
	}
	if err := s.clientsRepo.Create(client); err != nil {
		return nil, err
	}

	return clientToResult(client, secretPlain), nil
}

func (s *oauthService) AuthenticateConfidentialClient(clientID, clientSecret string) (*models.OAuthClient, error) {
	client, err := s.getActiveClient(clientID)
	if err != nil {
		return nil, err
	}
	if client.ClientType != models.OAuthClientTypeConfidential {
		return nil, ErrUnauthorizedClient
	}
	if err := s.verifyClientSecret(client, clientSecret); err != nil {
		return nil, err
	}
	return client, nil
}

func orgIDString(id *uuid.UUID) *string {
	if id == nil {
		return nil
	}
	s := id.String()
	return &s
}

func clientToResult(client *models.OAuthClient, secretPlain string) *CreateClientResult {
	return &CreateClientResult{
		ID:             client.ID.String(),
		ClientID:       client.ClientID,
		ClientSecret:   secretPlain,
		Name:           client.Name,
		RedirectURIs:   []string(client.RedirectURIs),
		Scopes:         []string(client.Scopes),
		ClientType:     client.ClientType,
		Trusted:        client.Trusted,
		Active:         client.Active,
		OrganizationID: orgIDString(client.OrganizationID),
		CreatedAt:      client.CreatedAt,
	}
}

func (s *oauthService) DeactivateClient(clientID string) error {
	client, err := s.clientsRepo.GetByClientID(clientID)
	if err != nil {
		return ErrInvalidClient
	}
	client.Active = false
	return s.clientsRepo.Update(client)
}

func (s *oauthService) ListClients() ([]CreateClientResult, error) {
	clients, err := s.clientsRepo.List()
	if err != nil {
		return nil, err
	}
	out := make([]CreateClientResult, 0, len(clients))
	for _, c := range clients {
		out = append(out, *clientToResult(&c, ""))
	}
	return out, nil
}

func (s *oauthService) AuthorizeUIURL(params AuthorizeParams) (string, error) {
	if err := s.ValidateAuthorizeParams(params); err != nil {
		return "", err
	}
	base := strings.TrimRight(s.cfg.OAuthUIBaseURL, "/")
	if base == "" {
		base = "http://localhost:3001"
	}
	q := url.Values{
		"page":          {"oauth-authorize"},
		"client_id":     {params.ClientID},
		"redirect_uri":  {params.RedirectURI},
		"response_type": {"code"},
		"state":         {params.State},
		"scope":         {normalizeScope(params.Scope)},
	}
	if params.CodeChallenge != "" {
		q.Set("code_challenge", params.CodeChallenge)
		method := params.CodeChallengeMethod
		if method == "" {
			method = "S256"
		}
		q.Set("code_challenge_method", method)
	}
	return appendQuery(base+"/", q)
}
