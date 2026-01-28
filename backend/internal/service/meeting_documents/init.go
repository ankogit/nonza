package meeting_documents

import "nonza/backend/internal/repository"

func NewMeetingDocumentsService(repo repository.MeetingDocuments) MeetingDocuments {
	return &meetingDocumentsService{repo: repo}
}
