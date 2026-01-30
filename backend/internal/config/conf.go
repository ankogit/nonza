package config

import (
	"github.com/joho/godotenv"
	"github.com/kelseyhightower/envconfig"
)

type Config struct {
	HTTPPort        string `envconfig:"HTTP_PORT" default:"8000"`
	HTTPReadTimeout string `envconfig:"HTTP_READ_TIMEOUT" default:"100s"`
	HTTPWriteTimeout string `envconfig:"HTTP_WRITE_TIMEOUT" default:"100s"`

	WebRTCPlatform  string `envconfig:"WEBRTC_PLATFORM" default:"livekit"`
	WebRTCURL       string `envconfig:"WEBRTC_URL"`
	WebRTCAPIKey    string `envconfig:"WEBRTC_API_KEY"`
	WebRTCAPISecret string `envconfig:"WEBRTC_API_SECRET"`

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
}

func Init() (*Config, error) {
	_ = godotenv.Load()

	var cfg Config
	err := envconfig.Process("", &cfg)
	if err != nil {
		return nil, err
	}

	return &cfg, nil
}
