package dto

import "nonza/backend/internal/models"

type CreateInviteRequest struct {
	Role      string `json:"role"`
	ExpiresIn string `json:"expires_in"`
}

type InviteResponse struct {
	Token            string `json:"token"`
	OrganizationID   string `json:"organization_id"`
	OrganizationName string `json:"organization_name"`
	Role             string `json:"role"`
	ExpiresAt        string `json:"expires_at"`
	AlreadyMember    bool   `json:"already_member,omitempty"`
}

func ToInviteResponse(inv *models.Invite, alreadyMember bool) InviteResponse {
	name := inv.Organization.Name
	return InviteResponse{
		Token:            inv.Token,
		OrganizationID:   inv.OrganizationID.String(),
		OrganizationName: name,
		Role:             inv.Role,
		ExpiresAt:        inv.ExpiresAt.Format("2006-01-02T15:04:05Z07:00"),
		AlreadyMember:    alreadyMember,
	}
}

type AcceptInviteRequest struct {
	UserID string `json:"user_id"`
}
