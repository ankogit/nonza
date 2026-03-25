package dto

type OrganizationSoundResponse struct {
	ID          string `json:"id"`
	Emoji       string `json:"emoji"`
	Title       string `json:"title"`
	AudioURL    string `json:"audioUrl"`
	Version     int    `json:"version"`
	LoopEnabled bool   `json:"loopEnabled"`
	GateEnabled bool   `json:"gateEnabled"`
	Volume      int    `json:"volume"`
	Speed       int    `json:"speed"`
}

