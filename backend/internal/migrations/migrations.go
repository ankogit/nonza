package migrations

import (
	"nonza/backend/internal/models"

	"gorm.io/gorm"
)

func RunMigrations(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.Organization{},
		&models.Room{},
		&models.MeetingDocument{},
		&models.Participant{},
		&models.DocumentOperation{},
	)
}
