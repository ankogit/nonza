package organizations

import "nonza/backend/internal/repository"

func NewOrganizationsService(repo repository.Organizations, members repository.OrganizationMembers, users repository.Users, txRunner repository.TransactionRunner) Organizations {
	return &organizationsService{repo: repo, members: members, users: users, txRunner: txRunner}
}
