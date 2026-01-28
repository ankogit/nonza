package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Organization struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Name        string    `gorm:"not null"`
	Description string
	OwnerID     *string `gorm:"type:varchar(255)"`
	Settings    JSONB   `gorm:"type:jsonb"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type JSONB map[string]interface{}

// Value implements driver.Valuer interface
func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan implements sql.Scanner interface
func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = make(JSONB)
		return nil
	}

	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		// Handle []uint8 (PostgreSQL returns this type for JSONB)
		if byteSlice, ok := value.([]uint8); ok {
			bytes = []byte(byteSlice)
		} else {
			return nil
		}
	}

	if len(bytes) == 0 {
		*j = make(JSONB)
		return nil
	}

	return json.Unmarshal(bytes, j)
}
