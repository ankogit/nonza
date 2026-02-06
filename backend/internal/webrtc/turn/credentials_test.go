package turn

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"testing"
)

// Credential must be base64(hmac_sha1(secret, username)) to match coturn lt-cred-mech.
// To verify on host: echo -n "<username>" | openssl dgst -sha1 -hmac "<secret>" -binary | base64
func TestLongTermCredentials_Deterministic(t *testing.T) {
	secret := "test_secret_32_chars_long!!!!!!!!"
	ttl := 3600

	u1, c1 := LongTermCredentials(secret, ttl)
	u2, c2 := LongTermCredentials(secret, ttl)

	if u1 != u2 || c1 != c2 {
		t.Errorf("same secret+ttl should give same creds: (%q,%q) vs (%q,%q)", u1, c1, u2, c2)
	}

	mac := hmac.New(sha1.New, []byte(secret))
	mac.Write([]byte(u1))
	expect := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	if c1 != expect {
		t.Errorf("credential should be base64(hmac_sha1(secret, username)); got %q, expected %q", c1, expect)
	}
}
