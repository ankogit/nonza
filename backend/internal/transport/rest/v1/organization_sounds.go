package v1

import (
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"nonza/backend/internal/service"
	"nonza/backend/internal/service/organization_sounds"
	orgSoundsDto "nonza/backend/internal/dto/organization_sounds"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type OrganizationSoundsHandler struct {
	Services *service.Services
}

func NewOrganizationSoundsHandler(services *service.Services) *OrganizationSoundsHandler {
	return &OrganizationSoundsHandler{Services: services}
}

func (h *OrganizationSoundsHandler) GetByOrganizationID(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}

	rows, err := h.Services.OrganizationSounds.ListForUser(orgID, c.GetString("user_id"))
	if err != nil {
		if errors.Is(err, organization_sounds.ErrUnauthorized) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		if errors.Is(err, organization_sounds.ErrForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load sounds"})
		return
	}

	resp := make([]orgSoundsDto.OrganizationSoundResponse, 0, len(rows))
	for _, s := range rows {
		resp = append(resp, orgSoundsDto.OrganizationSoundResponse{
			ID:          s.ID,
			Emoji:       s.Emoji,
			Title:       s.Title,
			AudioURL:    s.AudioURL,
			Version:     s.Version,
			LoopEnabled: s.LoopEnabled,
			GateEnabled: s.GateEnabled,
			Volume:      s.Volume,
			Speed:       s.Speed,
		})
	}

	c.JSON(http.StatusOK, resp)
}

func parseBool(v string) (bool, error) {
	v = strings.TrimSpace(v)
	if v == "" {
		return false, errors.New("empty bool")
	}
	return strconv.ParseBool(v)
}

func parseClientProcessed(raw string) bool {
	v := strings.TrimSpace(strings.ToLower(raw))
	return v == "1" || v == "true" || v == "yes"
}

func (h *OrganizationSoundsHandler) Upsert(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}

	emoji := strings.TrimSpace(c.PostForm("emoji"))
	title := strings.TrimSpace(c.PostForm("title"))
	startMsRaw := strings.TrimSpace(c.PostForm("startMs"))
	endMsRaw := strings.TrimSpace(c.PostForm("endMs"))
	loopEnabledRaw := strings.TrimSpace(c.PostForm("loopEnabled"))
	gateEnabledRaw := strings.TrimSpace(c.PostForm("gateEnabled"))
	volumeRaw := strings.TrimSpace(c.PostForm("volume"))
	speedRaw := strings.TrimSpace(c.PostForm("speed"))
	clientProcessed := parseClientProcessed(c.PostForm("clientProcessed"))

	if emoji == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "emoji required"})
		return
	}

	startMs, err := strconv.Atoi(startMsRaw)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid startMs"})
		return
	}
	endMs, err := strconv.Atoi(endMsRaw)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid endMs"})
		return
	}
	if endMs <= startMs {
		c.JSON(http.StatusBadRequest, gin.H{"error": "endMs must be > startMs"})
		return
	}

	loopEnabled, err := parseBool(loopEnabledRaw)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid loopEnabled"})
		return
	}
	gateEnabled, err := parseBool(gateEnabledRaw)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid gateEnabled"})
		return
	}

	volume, err := strconv.Atoi(volumeRaw)
	if err != nil || volume < 0 || volume > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid volume"})
		return
	}

	speed, err := strconv.Atoi(speedRaw)
	if err != nil || speed < 50 || speed > 150 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid speed"})
		return
	}

	file, _, err := c.Request.FormFile("audio")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "audio file required"})
		return
	}
	defer func() { _ = file.Close() }()

	tmp, err := os.CreateTemp("", "soundbar-upload-*")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create temp file"})
		return
	}
	tmpPath := tmp.Name()
	defer func() {
		_ = os.Remove(tmpPath)
	}()

	if _, err := io.Copy(tmp, file); err != nil {
		_ = tmp.Close()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save upload"})
		return
	}
	if err := tmp.Close(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to finalize upload"})
		return
	}

	row, err := h.Services.OrganizationSounds.UpsertWithFile(
		c.Request.Context(),
		organization_sounds.UpsertWithFileParams{
			OrgID:           orgID,
			UserID:          c.GetString("user_id"),
			Emoji:           emoji,
			Title:           title,
			StartMs:         startMs,
			EndMs:           endMs,
			LoopEnabled:     loopEnabled,
			GateEnabled:     gateEnabled,
			Volume:          volume,
			Speed:           speed,
			InputPath:       tmpPath,
			ClientProcessed: clientProcessed,
		},
	)
	if err != nil {
		if errors.Is(err, organization_sounds.ErrUnauthorized) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		if errors.Is(err, organization_sounds.ErrForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		log.Printf("organization sounds upsert: %v", err)
		resp := gin.H{"error": "failed to save sound"}
		if gin.Mode() == gin.DebugMode {
			resp["detail"] = err.Error()
		}
		c.JSON(http.StatusInternalServerError, resp)
		return
	}

	c.JSON(http.StatusOK, orgSoundsDto.OrganizationSoundResponse{
		ID:          row.ID,
		Emoji:       row.Emoji,
		Title:       row.Title,
		AudioURL:    row.AudioURL,
		Version:     row.Version,
		LoopEnabled: row.LoopEnabled,
		GateEnabled: row.GateEnabled,
		Volume:      row.Volume,
		Speed:       row.Speed,
	})
}

func (h *OrganizationSoundsHandler) Delete(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}

	soundID, err := uuid.Parse(c.Param("soundId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid sound id"})
		return
	}

	err = h.Services.OrganizationSounds.Delete(
		c.Request.Context(),
		orgID,
		soundID,
		c.GetString("user_id"),
	)
	if err != nil {
		if errors.Is(err, organization_sounds.ErrUnauthorized) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		if errors.Is(err, organization_sounds.ErrForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if errors.Is(err, organization_sounds.ErrSoundNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "sound not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete sound"})
		return
	}

	c.Status(http.StatusNoContent)
}

