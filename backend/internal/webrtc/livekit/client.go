package livekit

import (
	"nonza/backend/internal/config"

	"github.com/livekit/protocol/auth"
)

type Client struct {
	apiKey    string
	apiSecret string
	url       string
}

func NewClient(cfg *config.Config) *Client {
	return &Client{
		apiKey:    cfg.WebRTCAPIKey,
		apiSecret: cfg.WebRTCAPISecret,
		url:       cfg.WebRTCURL,
	}
}

func (c *Client) GenerateAccessToken(roomName, participantIdentity string, participantName string) (string, error) {
	at := auth.NewAccessToken(c.apiKey, c.apiSecret)
	canPublish := true
	canSubscribe := true
	canUpdateOwnMetadata := true
	grant := &auth.VideoGrant{
		RoomJoin:            true,
		Room:                roomName,
		CanPublish:          &canPublish,
		CanSubscribe:        &canSubscribe,
		CanUpdateOwnMetadata: &canUpdateOwnMetadata,
	}

	at.AddGrant(grant).
		SetIdentity(participantIdentity).
		SetName(participantName).
		SetValidFor(24 * 3600)

	return at.ToJWT()
}
