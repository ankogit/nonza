package app

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"nonza/backend/internal/config"
	"nonza/backend/internal/migrations"
	"nonza/backend/internal/repository"
	"nonza/backend/internal/repository/postgresDB"
	"nonza/backend/internal/repository/redis"
	"nonza/backend/internal/service"
	"nonza/backend/internal/transport/rest"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/robfig/cron/v3"
)

func Run(cfg *config.Config) error {
	logger := log.New(os.Stdout, "[nonza] ", log.LstdFlags)

	logger.Printf("Initializing database connection with config: host=%s, port=%s, user=%s, dbname=%s",
		cfg.DB.Host, cfg.DB.Port, cfg.DB.Username, cfg.DB.DBName)
	
	db, err := postgresDB.NewPostgresDB(postgresDB.Config{
		Host:          cfg.DB.Host,
		Port:          cfg.DB.Port,
		Username:      cfg.DB.Username,
		Password:      cfg.DB.Password,
		DBName:        cfg.DB.DBName,
		SSLMode:       cfg.DB.SSLMode,
		Environment:   cfg.Env,
		SlowThreshold: 200 * time.Millisecond,
	})
	if err != nil {
		logger.Printf("Failed to initialize database connection: %v", err)
		return fmt.Errorf("failed to connect to database: %w", err)
	}
	logger.Printf("Database connection established successfully")
	defer func() {
		if err := postgresDB.CloseDB(db); err != nil {
			logger.Printf("Failed to close database: %v", err)
		}
	}()

	if err := migrations.RunMigrations(db); err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	// Initialize Redis client
	logger.Printf("Initializing Redis connection with config: host=%s, port=%s, db=%d",
		cfg.Redis.Host, cfg.Redis.Port, cfg.Redis.DB)
	redisCli, err := redis.NewClient(redis.Config{
		Host:     cfg.Redis.Host,
		Port:     cfg.Redis.Port,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
		UseSSL:   cfg.Redis.UseSSL,
	})
	if err != nil {
		logger.Printf("Failed to initialize Redis connection: %v", err)
		return fmt.Errorf("failed to connect to Redis: %w", err)
	}
	logger.Printf("Redis connection established successfully")
	defer func() {
		if err := redisCli.Close(); err != nil {
			logger.Printf("Failed to close Redis connection: %v", err)
		}
	}()

	// Parse document TTL
	documentTTL, err := time.ParseDuration(cfg.DocumentTTL)
	if err != nil {
		logger.Printf("Invalid DOCUMENT_TTL format, using default 24h: %v", err)
		documentTTL = 24 * time.Hour
	}
	logger.Printf("Document TTL set to: %v", documentTTL)

	repositories := repository.NewRepositories(db)
	services := service.NewServices(service.Deps{
		Repositories: repositories,
	})

	restHandler := rest.NewHandler(services, redisCli, repositories.Rooms, cfg.DocumentTTL)
	router := restHandler.InitRoutes(cfg)

	// Setup cron for expired rooms cleanup
	c := cron.New(cron.WithSeconds())
	
	// Parse cleanup schedule (default: every hour at minute 0)
	cleanupSchedule := cfg.CleanupSchedule
	if cleanupSchedule == "" {
		cleanupSchedule = "0 0 * * * *" // Every hour
	}
	
	_, err = c.AddFunc(cleanupSchedule, func() {
		logger.Printf("Running expired rooms cleanup task")
		expiredRooms, err := services.Rooms.GetExpired()
		if err != nil {
			logger.Printf("Error getting expired rooms: %v", err)
			return
		}

		if len(expiredRooms) == 0 {
			return
		}

		logger.Printf("Found %d expired rooms, cleaning up documents", len(expiredRooms))

		for _, room := range expiredRooms {
			roomID := room.ID.String()
			
			// Delete document from Redis
			if err := redisCli.DeleteDocumentState(roomID); err != nil {
				logger.Printf("Error deleting document for expired room %s: %v", roomID, err)
			} else {
				logger.Printf("Deleted document for expired room %s", roomID)
			}
		}

		// Delete expired rooms from database
		if err := services.Rooms.DeleteExpired(); err != nil {
			logger.Printf("Error deleting expired rooms from database: %v", err)
		} else {
			logger.Printf("Deleted %d expired rooms from database", len(expiredRooms))
		}
	})
	
	if err != nil {
		logger.Printf("Error setting up cleanup cron job: %v", err)
		return fmt.Errorf("failed to setup cleanup cron: %w", err)
	}
	
	c.Start()
	logger.Printf("Started expired rooms cleanup cron job (schedule: %s)", cleanupSchedule)
	defer c.Stop()

	httpServer := &http.Server{
		Addr:         ":" + cfg.HTTPPort,
		ReadTimeout:  100 * time.Second,
		WriteTimeout: 100 * time.Second,
		Handler:      router,
	}

	go func() {
		logger.Printf("Starting HTTP server on port %s", cfg.HTTPPort)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatalf("HTTP server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	logger.Println("Server started")
	<-quit

	logger.Println("Shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		return fmt.Errorf("error shutting down server: %w", err)
	}

	_ = services
	return nil
}
