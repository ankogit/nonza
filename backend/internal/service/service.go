package service

import (
	"nonza/backend/internal/config"
	"nonza/backend/internal/repository"
	"nonza/backend/internal/service/auth"
	"nonza/backend/internal/service/invites"
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
}

type Deps struct {
	Repositories *repository.Repositories
	Config       *config.Config
}

func NewServices(deps Deps) *Services {
	return &Services{
		Auth:             auth.NewAuthService(deps.Repositories.Users, deps.Config),
		Organizations:    organizations.NewOrganizationsService(deps.Repositories.Organizations, deps.Repositories.OrganizationMembers, deps.Repositories.Users),
		Rooms:            rooms.NewRoomsService(deps.Repositories.Rooms, deps.Repositories.Organizations),
		RoomGroups:       room_groups.NewRoomGroupsService(deps.Repositories.RoomGroups, deps.Repositories.Rooms, deps.Repositories.Organizations),
		MeetingDocuments: meeting_documents.NewMeetingDocumentsService(deps.Repositories.MeetingDocuments),
		Invites:          invites.NewInvitesService(deps.Repositories.Invites, deps.Repositories.OrganizationMembers, deps.Repositories.Organizations),
	}
}
