package rooms

import (
	"time"

	"nonza/backend/internal/models"
)

func cloneJSONB(src models.JSONB) models.JSONB {
	if src == nil {
		return models.JSONB{}
	}
	out := make(models.JSONB, len(src))
	for k, v := range src {
		out[k] = v
	}
	return out
}

func ApplyParticipantCountToRoomTimer(room *models.Room, participantCount int) bool {
	timerEnabled := false
	if room.Settings != nil {
		if v, ok := room.Settings["room_timer_enabled"].(bool); ok {
			timerEnabled = v
		}
	}
	if !timerEnabled {
		return false
	}
	newSettings := cloneJSONB(room.Settings)
	changed := false
	switch participantCount {
	case 0:
		if _, ok := newSettings["room_timer_started_at"]; ok {
			delete(newSettings, "room_timer_started_at")
			changed = true
		}
	case 1:
		if _, ok := newSettings["room_timer_started_at"]; !ok {
			newSettings["room_timer_started_at"] = time.Now().UTC().Format(time.RFC3339Nano)
			changed = true
		}
	}
	if !changed {
		return false
	}
	room.Settings = newSettings
	return true
}
