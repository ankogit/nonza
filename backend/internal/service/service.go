package service

import (
	"nonza/backend/internal/repository"
	"nonza/backend/internal/service/meeting_documents"
	"nonza/backend/internal/service/organizations"
	"nonza/backend/internal/service/rooms"
)

type Services struct {
	Organizations    organizations.Organizations
	Rooms            rooms.Rooms
	MeetingDocuments meeting_documents.MeetingDocuments
}

type Deps struct {
	Repositories *repository.Repositories
}

func NewServices(deps Deps) *Services {
	return &Services{
		Organizations:    organizations.NewOrganizationsService(deps.Repositories.Organizations),
		Rooms:            rooms.NewRoomsService(deps.Repositories.Rooms, deps.Repositories.Organizations),
		MeetingDocuments: meeting_documents.NewMeetingDocumentsService(deps.Repositories.MeetingDocuments),
	}
}
