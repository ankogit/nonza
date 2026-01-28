package main

import (
	"log"
	"nonza/backend/internal/app"
	"nonza/backend/internal/config"

	_ "github.com/lib/pq"
)

func main() {
	cfg, err := config.Init()
	if err != nil {
		log.Fatal("Failed to init config: ", err)
	}

	if err := app.Run(cfg); err != nil {
		log.Fatal("Failed to run app: ", err)
	}
}
