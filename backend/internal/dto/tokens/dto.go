package dto

type GenerateTokenRequest struct {
	ShortCode       string `json:"short_code" binding:"required"`
	ParticipantID   string `json:"participant_id"`
	ParticipantName string `json:"participant_name"`
}

type TokenResponse struct {
	Token         string `json:"token"`
	URL           string `json:"url"`
	RoomName      string `json:"room_name"`
	ParticipantID string `json:"participant_id"`
}
