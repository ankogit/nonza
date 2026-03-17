package v1

import (
	"net/http"
	"strings"

	"nonza/backend/internal/config"

	"github.com/gin-gonic/gin"
	"golang.org/x/mod/semver"
)

func DesktopUpdate(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		if cfg.DesktopUpdate == nil {
			c.Status(http.StatusNoContent)
			return
		}

		target := c.Param("target")
		arch := c.Param("arch")
		currentVersion := strings.TrimSpace(c.Param("current_version"))
		if target == "" || arch == "" || currentVersion == "" {
			c.Status(http.StatusNoContent)
			return
		}

		platformKey := target + "-" + arch
		platform, ok := cfg.DesktopUpdate.Platforms[platformKey]
		if !ok || platform.URL == "" || platform.Signature == "" {
			c.Status(http.StatusNoContent)
			return
		}

		currentNorm := currentVersion
		if !strings.HasPrefix(currentNorm, "v") {
			currentNorm = "v" + currentNorm
		}
		updateNorm := cfg.DesktopUpdate.Version
		if !strings.HasPrefix(updateNorm, "v") {
			updateNorm = "v" + updateNorm
		}
		if semver.Compare(currentNorm, updateNorm) >= 0 {
			c.Status(http.StatusNoContent)
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"version":   cfg.DesktopUpdate.Version,
			"notes":     cfg.DesktopUpdate.Notes,
			"pub_date":  cfg.DesktopUpdate.PubDate,
			"url":       platform.URL,
			"signature": platform.Signature,
		})
	}
}
