package repository

import (
	"nonza/backend/internal/repository/postgresDB"

	"gorm.io/gorm"
)

type Repositories struct {
	Organizations    Organizations
	Rooms            Rooms
	MeetingDocuments MeetingDocuments
	Participants     Participants
}

func NewRepositories(db *gorm.DB) *Repositories {
	orgRepo := postgresDB.NewOrganizationsRepository(db)
	roomRepo := postgresDB.NewRoomsRepository(db)
	docRepo := postgresDB.NewMeetingDocumentsRepository(db)
	partRepo := postgresDB.NewParticipantsRepository(db)

	return &Repositories{
		Organizations:    orgRepo,
		Rooms:            roomRepo,
		MeetingDocuments: docRepo,
		Participants:     partRepo,
	}
}
