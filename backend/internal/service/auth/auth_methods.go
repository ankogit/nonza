package auth

type PublicAuthMethods struct {
	Password     bool `json:"password"`
	Google       bool `json:"google"`
	Mandarinshow bool `json:"mandarinshow"`
	Keycloak     bool `json:"keycloak"`
}

func (s *authService) PublicAuthMethods() PublicAuthMethods {
	google := false
	if s.cfg.AuthEnableGoogle {
		if _, err := s.googleOAuthConfig(); err == nil {
			google = true
		}
	}
	mandarinshow := false
	if s.cfg.AuthEnableMandarinshow && s.mandarinshowOAuthConfigured() {
		mandarinshow = true
	}
	keycloak := false
	if s.cfg.AuthEnableKeycloak && s.keycloakOAuthConfigured() {
		keycloak = true
	}
	return PublicAuthMethods{
		Password:     s.cfg.AuthEnablePassword,
		Google:       google,
		Mandarinshow: mandarinshow,
		Keycloak:     keycloak,
	}
}

func (s *authService) ensurePasswordAuthEnabled() error {
	if !s.cfg.AuthEnablePassword {
		return ErrAuthMethodDisabled
	}
	return nil
}

func (s *authService) ensureGoogleAuthEnabled() error {
	if !s.cfg.AuthEnableGoogle {
		return ErrAuthMethodDisabled
	}
	return nil
}

func (s *authService) ensureMandarinshowAuthEnabled() error {
	if !s.cfg.AuthEnableMandarinshow {
		return ErrAuthMethodDisabled
	}
	return nil
}

func (s *authService) ensureKeycloakAuthEnabled() error {
	if !s.cfg.AuthEnableKeycloak {
		return ErrAuthMethodDisabled
	}
	return nil
}
