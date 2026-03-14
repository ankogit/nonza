package migrations

import (
	"nonza/backend/internal/models"

	"gorm.io/gorm"
)

func RunMigrations(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.User{},
		&models.Organization{},
		&models.OrganizationMember{},
		&models.Invite{},
		&models.RoomGroup{},
		&models.Room{},
		&models.MeetingDocument{},
		&models.Participant{},
		&models.DocumentOperation{},
	)
}
