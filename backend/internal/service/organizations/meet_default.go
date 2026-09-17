package organizations

import "nonza/backend/internal/models"

const (
	meetDefaultOrgName        = "Default Organization"
	meetDefaultOrgDescription = "Default organization for rooms"
)

// IsMeetDefault reports whether the org is the disposable meet.nonza container
// (no organization soundbar), including legacy rows created before meet_default settings.
func IsMeetDefault(org *models.Organization) bool {
	if org == nil {
		return false
	}
	if org.Settings != nil {
		if v, ok := org.Settings["meet_default"].(bool); ok {
			return v
		}
	}
	return org.Name == meetDefaultOrgName && org.Description == meetDefaultOrgDescription
}
