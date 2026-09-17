package oauth

import "testing"

func TestNormalizeScope(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"", "openid profile"},
		{"openid profile", "openid profile"},
		{"profile openid offline_access", "offline_access openid profile"},
		{"invalid", ""},
	}
	for _, tc := range tests {
		if got := normalizeScope(tc.in); got != tc.want {
			t.Fatalf("normalizeScope(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestVerifyPKCE(t *testing.T) {
	verifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	challenge := "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
	if !verifyPKCE(verifier, challenge, "S256") {
		t.Fatal("expected valid PKCE pair")
	}
	if verifyPKCE("wrong", challenge, "S256") {
		t.Fatal("expected invalid PKCE pair")
	}
}

func TestRedirectURIAllowed(t *testing.T) {
	uris := []string{"https://partner.example/callback"}
	if !redirectURIAllowed(uris, "https://partner.example/callback") {
		t.Fatal("expected redirect uri to be allowed")
	}
	if redirectURIAllowed(uris, "https://evil.example/callback") {
		t.Fatal("expected redirect uri to be rejected")
	}
}
