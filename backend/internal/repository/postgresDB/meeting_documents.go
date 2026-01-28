package postgresDB

import (
	"nonza/backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type MeetingDocumentsRepository struct {
	db *gorm.DB
}

func NewMeetingDocumentsRepository(db *gorm.DB) *MeetingDocumentsRepository {
	return &MeetingDocumentsRepository{db: db}
}

func (r *MeetingDocumentsRepository) Create(doc *models.MeetingDocument) error {
	return r.db.Create(doc).Error
}

func (r *MeetingDocumentsRepository) GetByRoomID(roomID uuid.UUID) (*models.MeetingDocument, error) {
	var doc models.MeetingDocument
	err := r.db.Where("room_id = ?", roomID).First(&doc).Error
	if err != nil {
		return nil, err
	}
	return &doc, nil
}

func (r *MeetingDocumentsRepository) Update(doc *models.MeetingDocument) error {
	return r.db.Save(doc).Error
}

func (r *MeetingDocumentsRepository) IncrementVersion(roomID uuid.UUID) error {
	return r.db.Model(&models.MeetingDocument{}).
		Where("room_id = ?", roomID).
		Update("version", gorm.Expr("version + 1")).Error
}
