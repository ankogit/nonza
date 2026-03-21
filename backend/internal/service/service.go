package service

import (
	"nonza/backend/internal/config"
	"nonza/backend/internal/repository"
	"nonza/backend/internal/storage"
	"nonza/backend/internal/service/auth"
	"nonza/backend/internal/service/files"
	"nonza/backend/internal/service/invites"
	"nonza/backend/internal/service/organization_sounds"
	"nonza/backend/internal/service/meeting_documents"
	"nonza/backend/internal/service/organizations"
	"nonza/backend/internal/service/room_groups"
	"nonza/backend/internal/service/rooms"
)

type Services struct {
	Auth             auth.Auth
	Organizations    organizations.Organizations
	Rooms            rooms.Rooms
	RoomGroups       room_groups.RoomGroups
	MeetingDocuments meeting_documents.MeetingDocuments
	Invites          invites.Invites
	OrganizationSounds organization_sounds.OrganizationSounds
	Files            files.Files
}

type Deps struct {
	Repositories      *repository.Repositories
	TransactionRunner repository.TransactionRunner
	Config            *config.Config
	ObjectStorage     storage.ObjectStorage
}

func NewServices(deps Deps) *Services {
	orgsSvc := organizations.NewOrganizationsService(
		deps.Repositories.Organizations,
		deps.Repositories.OrganizationMembers,
		deps.Repositories.Users,
		deps.TransactionRunner,
	)
	filesSvc := files.NewFilesService(deps.Repositories.Files, deps.ObjectStorage)

	return &Services{
		Auth:             auth.NewAuthService(deps.Repositories.Users, deps.Config),
		Organizations:    orgsSvc,
		Rooms:            rooms.NewRoomsService(deps.Repositories.Rooms, deps.Repositories.Organizations),
		RoomGroups:       room_groups.NewRoomGroupsService(deps.Repositories.RoomGroups, deps.Repositories.Rooms, deps.Repositories.Organizations),
		MeetingDocuments: meeting_documents.NewMeetingDocumentsService(deps.Repositories.MeetingDocuments),
		Invites:          invites.NewInvitesService(deps.Repositories.Invites, deps.Repositories.OrganizationMembers, deps.Repositories.Organizations),
		OrganizationSounds: organization_sounds.NewOrganizationSoundsService(
			deps.Repositories.OrganizationSounds,
			orgsSvc,
			filesSvc,
		),
		Files: filesSvc,
	}
}
