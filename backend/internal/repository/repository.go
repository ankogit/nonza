package repository

import (
	"nonza/backend/internal/repository/postgresDB"

	"gorm.io/gorm"
)

type Repositories struct {
	Users               Users
	Organizations       Organizations
	OrganizationMembers OrganizationMembers
	Invites             Invites
	Rooms               Rooms
	RoomGroups          RoomGroups
	MeetingDocuments    MeetingDocuments
	Participants        Participants
}

func NewRepositories(db *gorm.DB) *Repositories {
	usersRepo := postgresDB.NewUsersRepository(db)
	orgRepo := postgresDB.NewOrganizationsRepository(db)
	orgMembersRepo := postgresDB.NewOrganizationMembersRepository(db)
	invitesRepo := postgresDB.NewInvitesRepository(db)
	roomRepo := postgresDB.NewRoomsRepository(db)
	roomGroupsRepo := postgresDB.NewRoomGroupsRepository(db)
	docRepo := postgresDB.NewMeetingDocumentsRepository(db)
	partRepo := postgresDB.NewParticipantsRepository(db)

	return &Repositories{
		Users:               usersRepo,
		Organizations:       orgRepo,
		OrganizationMembers: orgMembersRepo,
		Invites:             invitesRepo,
		Rooms:               roomRepo,
		RoomGroups:          roomGroupsRepo,
		MeetingDocuments:    docRepo,
		Participants:        partRepo,
	}
}
