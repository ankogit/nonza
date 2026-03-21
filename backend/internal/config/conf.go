package config

import (
	"encoding/json"
	"log"
	"strings"

	"github.com/joho/godotenv"
	"github.com/kelseyhightower/envconfig"
)

type DesktopUpdatePlatform struct {
	URL       string `json:"url"`
	Signature string `json:"signature"`
}

type DesktopUpdateManifest struct {
	Version   string                         `json:"version"`
	Notes    string                         `json:"notes"`
	PubDate  string                         `json:"pub_date"`
	Platforms map[string]DesktopUpdatePlatform `json:"platforms"`
}

type Config struct {
	HTTPPort        string `envconfig:"HTTP_PORT" default:"8000"`
	HTTPReadTimeout string `envconfig:"HTTP_READ_TIMEOUT" default:"100s"`
	HTTPWriteTimeout string `envconfig:"HTTP_WRITE_TIMEOUT" default:"100s"`

	WebRTCPlatform  string `envconfig:"WEBRTC_PLATFORM" default:"livekit"`
	WebRTCURL       string `envconfig:"WEBRTC_URL"`
	// URL, который отдаётся клиенту (браузеру). Должен быть публичный wss://. Если пусто — используется WebRTCURL.
	WebRTCPublicURL string `envconfig:"WEBRTC_PUBLIC_URL"`
	WebRTCAPIKey    string `envconfig:"WEBRTC_API_KEY"`
	WebRTCAPISecret string `envconfig:"WEBRTC_API_SECRET"`

	// Внешний TURN (coturn): URL для клиента (turns:turn.nonza.ru:5349) и секрет для HMAC long-term credential.
	// Если TURN_URL пустой — ice_servers в ответ токена не добавляются.
	TURNURL    string `envconfig:"TURN_URL"`
	TURNSecret string `envconfig:"TURN_SECRET"`
	TURNTTL    int    `envconfig:"TURN_TTL" default:"86400"`

	AudioCodec        string `envconfig:"AUDIO_CODEC" default:"opus"`
	AudioBitrate      int    `envconfig:"AUDIO_BITRATE" default:"32000"`
	AudioSampleRate   int    `envconfig:"AUDIO_SAMPLE_RATE" default:"48000"`
	AudioUseInbandFEC bool   `envconfig:"AUDIO_USE_INBAND_FEC" default:"true"`
	AudioChannels     int    `envconfig:"AUDIO_CHANNELS" default:"1"`

	JWTSecret            string `envconfig:"JWT_SECRET"`
	JWTAccessTokenTTL    string `envconfig:"JWT_ACCESS_TOKEN_TTL" default:"30m"`
	JWTRefreshTokenTTL    string `envconfig:"JWT_REFRESH_TOKEN_TTL" default:"7d"`
	E2EEEnabled          bool   `envconfig:"E2EE_ENABLED" default:"true"`
	E2EERequire          bool   `envconfig:"E2EE_REQUIRE" default:"true"`
	E2EEKeyRotationInterval string `envconfig:"E2EE_KEY_ROTATION_INTERVAL" default:"1h"`
	E2EEFallbackWarning  bool   `envconfig:"E2EE_FALLBACK_WARNING" default:"true"`

	RateLimitTokensPerMinute int `envconfig:"RATE_LIMIT_TOKENS_PER_MINUTE" default:"20"`
	RateLimitBurst            int `envconfig:"RATE_LIMIT_BURST" default:"5"`

	DB struct {
		Host     string `envconfig:"DB_HOST" default:"localhost"`
		Port     string `envconfig:"DB_PORT" default:"5432"`
		Username string `envconfig:"DB_USERNAME" default:"nonza"`
		Password string `envconfig:"DB_PASSWORD"`
		DBName   string `envconfig:"DB_DATABASE" default:"nonza"`
		SSLMode  string `envconfig:"DB_SSL_MODE" default:"disable"`
	}

	Redis struct {
		Host     string `envconfig:"REDIS_HOST" default:"localhost"`
		Port     string `envconfig:"REDIS_PORT" default:"6379"`
		Password string `envconfig:"REDIS_PASSWORD"`
		DB       int    `envconfig:"REDIS_DB" default:"1"`
		UseSSL   bool   `envconfig:"REDIS_USE_SSL" default:"false"`
	}

	LiveKitServer struct {
		Host     string `envconfig:"LIVEKIT_SERVER_HOST" default:"localhost"`
		Port     string `envconfig:"LIVEKIT_SERVER_PORT" default:"7880"`
		RedisURL string `envconfig:"LIVEKIT_REDIS_URL"`
	}

	S3 struct {
		Endpoint      string `envconfig:"S3_ENDPOINT"`
		AccessKey     string `envconfig:"S3_ACCESS_KEY"`
		SecretKey     string `envconfig:"S3_SECRET_KEY"`
		Bucket        string `envconfig:"S3_BUCKET"`
		UseSSL        bool   `envconfig:"S3_USE_SSL" default:"false"`
		Region        string `envconfig:"S3_REGION" default:"us-east-1"`
		PublicBaseURL string `envconfig:"S3_PUBLIC_BASE_URL"`
	}

	CacheTTL string `envconfig:"CACHE_TTL" default:"60s"`

	// Document TTL - how long to keep document state in Redis after room becomes empty
	DocumentTTL string `envconfig:"DOCUMENT_TTL" default:"24h"`

	// Cleanup schedule - cron expression for expired rooms cleanup (default: every hour)
	// Format: "second minute hour day month weekday"
	// Example: "0 0 * * * *" = every hour at minute 0
	// Example: "0 */30 * * * *" = every 30 minutes
	CleanupSchedule string `envconfig:"CLEANUP_SCHEDULE" default:"0 0 * * * *"`

	Env   string `envconfig:"ENV" default:"local"`
	Debug bool   `envconfig:"DEBUG" default:"false"`

	// CORS: через запятую, например https://meet.nonza.ru,https://www.nonza.ru
	CORSAllowedOrigins string `envconfig:"CORS_ALLOWED_ORIGINS"`

	// Десктоп-приложение: актуальная версия и артефакты для обновления.
	// Если пусто — эндпоинт обновления отдаёт 204 (обновления нет).
	// Формат JSON: {"version":"0.1.1","notes":"","pub_date":"2025-03-17T12:00:00Z","platforms":{"darwin-aarch64":{"url":"https://...","signature":"..."},"darwin-x86_64":{...},"windows-x86_64":{...},"linux-x86_64":{...}}}
	DesktopAppUpdateJSON string `envconfig:"DESKTOP_APP_UPDATE_JSON"`
	DesktopUpdate        *DesktopUpdateManifest

	// Каталог с артефактами для скачивания десктоп-приложения.
	// Ожидаются файлы: windows.msi (или произвольное имя .msi), macos.dmg (или произвольное имя .dmg).
	// Если пусто — эндпоинт скачивания отдаёт 404.
	DesktopDownloadDir string `envconfig:"DESKTOP_DOWNLOAD_DIR"`
}

func Init() (*Config, error) {
	_ = godotenv.Load()

	var cfg Config
	err := envconfig.Process("", &cfg)
	if err != nil {
		return nil, err
	}

	if cfg.DesktopAppUpdateJSON != "" {
		raw := strings.TrimSpace(cfg.DesktopAppUpdateJSON)
		var manifest DesktopUpdateManifest
		if err := json.Unmarshal([]byte(raw), &manifest); err != nil {
			log.Printf("[config] invalid DESKTOP_APP_UPDATE_JSON, desktop updates disabled: %v", err)
		} else {
			cfg.DesktopUpdate = &manifest
		}
	}

	return &cfg, nil
}
