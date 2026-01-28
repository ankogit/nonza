package postgresDB

import (
	"fmt"
	"log"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Config struct {
	Host          string
	Port          string
	Username      string
	Password      string
	DBName        string
	SSLMode       string
	Environment   string
	SlowThreshold time.Duration
}

func NewPostgresDB(cfg Config) (*gorm.DB, error) {
	log.Printf("[PostgresDB] Initializing database connection")
	log.Printf("[PostgresDB] Config: host=%s, port=%s, user=%s, dbname=%s, sslmode=%s", 
		cfg.Host, cfg.Port, cfg.Username, cfg.DBName, cfg.SSLMode)
	
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.Username, cfg.Password, cfg.DBName, cfg.SSLMode,
	)
	log.Printf("[PostgresDB] DSN: host=%s port=%s user=%s password=*** dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.Username, cfg.DBName, cfg.SSLMode)

	var logLevel logger.LogLevel
	if cfg.Environment == "local" {
		logLevel = logger.Info
	} else {
		logLevel = logger.Error
	}

	log.Printf("[PostgresDB] Attempting to connect to database...")
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	})
	if err != nil {
		log.Printf("[PostgresDB] Failed to connect to database: %v", err)
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}
	log.Printf("[PostgresDB] Successfully opened GORM connection")

	sqlDB, err := db.DB()
	if err != nil {
		log.Printf("[PostgresDB] Failed to get sql.DB: %v", err)
		return nil, fmt.Errorf("failed to get sql.DB: %w", err)
	}

	log.Printf("[PostgresDB] Testing database connection with ping...")
	if err := sqlDB.Ping(); err != nil {
		log.Printf("[PostgresDB] Database ping failed: %v", err)
		return nil, fmt.Errorf("database ping failed: %w", err)
	}
	log.Printf("[PostgresDB] Database ping successful")

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	log.Printf("[PostgresDB] Database connection pool configured: maxIdle=10, maxOpen=100, maxLifetime=1h")
	return db, nil
}

func CloseDB(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
