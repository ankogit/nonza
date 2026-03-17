package v1

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"nonza/backend/internal/config"

	"github.com/gin-gonic/gin"
)

func DesktopDownload(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		if cfg.DesktopDownloadDir == "" {
			c.Status(http.StatusNotFound)
			return
		}
		platform := strings.ToLower(strings.TrimSpace(c.Param("platform")))
		if platform != "windows" && platform != "macos" {
			c.Status(http.StatusNotFound)
			return
		}
		ext := ".msi"
		if platform == "macos" {
			ext = ".dmg"
		}
		var found string
		entries, err := os.ReadDir(cfg.DesktopDownloadDir)
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			name := e.Name()
			if strings.EqualFold(filepath.Ext(name), ext) {
				found = filepath.Join(cfg.DesktopDownloadDir, name)
				break
			}
		}
		if found == "" {
			c.Status(http.StatusNotFound)
			return
		}
		c.Header("Content-Disposition", "attachment; filename=\""+filepath.Base(found)+"\"")
		c.File(found)
	}
}
