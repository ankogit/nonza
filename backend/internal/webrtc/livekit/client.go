package livekit

import (
	"context"
	"log"
	"net/http"
	"strings"

	"nonza/backend/internal/config"

	"github.com/livekit/protocol/auth"
	"github.com/livekit/protocol/livekit"
)

type Client struct {
	apiKey    string
	apiSecret string
	url       string
}

func (c *Client) roomServiceURL() string {
	u := c.url
	var rest string
	switch {
	case strings.HasPrefix(u, "wss://"):
		rest = strings.TrimPrefix(u, "wss://")
	case strings.HasPrefix(u, "ws://"):
		rest = strings.TrimPrefix(u, "ws://")
		return "http://" + rest
	default:
		return u
	}
	if strings.HasPrefix(rest, "localhost") || strings.HasPrefix(rest, "127.0.0.1") {
		return "http://" + rest
	}
	return "https://" + rest
}

func (c *Client) apiTokenForRoom(roomName string) (string, error) {
	at := auth.NewAccessToken(c.apiKey, c.apiSecret)
	at.SetVideoGrant(&auth.VideoGrant{RoomAdmin: true, Room: roomName}).
		SetIdentity("sdk").
		SetValidFor(300)
	return at.ToJWT()
}

func (c *Client) roomServiceForRoom(roomName string) livekit.RoomService {
	baseURL := c.roomServiceURL()
	tokenFn := func() (string, error) { return c.apiTokenForRoom(roomName) }
	client := &http.Client{
		Transport: &authTransport{client: http.DefaultTransport, tokenFn: tokenFn},
	}
	return livekit.NewRoomServiceJSONClient(baseURL, client)
}

type authTransport struct {
	client  http.RoundTripper
	tokenFn func() (string, error)
}

func (t *authTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	token, err := t.tokenFn()
	if err != nil {
		return nil, err
	}
	req = req.Clone(req.Context())
	req.Header.Set("Authorization", "Bearer "+token)
	return t.client.RoundTrip(req)
}

type ParticipantInfo struct {
	Identity string `json:"identity"`
	Name     string `json:"name"`
}

func (c *Client) ListParticipants(ctx context.Context, liveKitRoomName string) ([]ParticipantInfo, error) {
	if liveKitRoomName == "" {
		log.Printf("[livekit] ListParticipants room empty, skip")
		return nil, nil
	}
	baseURL := c.roomServiceURL()
	log.Printf("[livekit] ListParticipants room=%q roomServiceURL=%s", liveKitRoomName, baseURL)
	svc := c.roomServiceForRoom(liveKitRoomName)
	res, err := svc.ListParticipants(ctx, &livekit.ListParticipantsRequest{
		Room: liveKitRoomName,
	})
	if err != nil {
		log.Printf("[livekit] ListParticipants room=%q err=%v", liveKitRoomName, err)
		return nil, err
	}
	out := make([]ParticipantInfo, 0, len(res.Participants))
	for _, p := range res.Participants {
		if p.State == livekit.ParticipantInfo_ACTIVE || p.State == livekit.ParticipantInfo_JOINED {
			name := p.Name
			if name == "" {
				name = p.Identity
			}
			out = append(out, ParticipantInfo{Identity: p.Identity, Name: name})
		}
	}
	log.Printf("[livekit] ListParticipants room=%q total=%d active=%d", liveKitRoomName, len(res.Participants), len(out))
	return out, nil
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

	at.SetVideoGrant(grant).
		SetIdentity(participantIdentity).
		SetName(participantName).
		SetValidFor(24 * 3600)

	return at.ToJWT()
}
