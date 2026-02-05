package turn

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"fmt"
	"time"
)

// LongTermCredentials returns username and credential for TURN (coturn lt-cred-mech).
// username = timestamp:ttl, credential = base64(hmac_sha1(secret, username)).
func LongTermCredentials(secret string, ttlSec int) (username, credential string) {
	now := time.Now().Unix()
	username = fmt.Sprintf("%d:%d", now, ttlSec)
	mac := hmac.New(sha1.New, []byte(secret))
	mac.Write([]byte(username))
	credential = base64.StdEncoding.EncodeToString(mac.Sum(nil))
	return username, credential
}

// ValidateTTL checks if username (format "timestamp:ttl") is still within validity.
func ValidateTTL(username string) bool {
	var ts, ttl int64
	_, err := fmt.Sscanf(username, "%d:%d", &ts, &ttl)
	if err != nil {
		return false
	}
	return time.Now().Unix() < ts+ttl
}
