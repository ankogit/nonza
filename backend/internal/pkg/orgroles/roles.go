package orgroles

const (
	RoleOwner  = "owner"
	RoleAdmin  = "admin"
	RoleMember = "member"
)

const (
	PermissionManageOrg      = "manage_org"
	PermissionManageMembers  = "manage_members"
	PermissionManageRoles    = "manage_roles"
	PermissionCreateRoom     = "create_room"
	PermissionEditRoom       = "edit_room"
	PermissionDeleteRoom     = "delete_room"
	PermissionInvite         = "invite"
)

var allPermissions = []string{
	PermissionManageOrg, PermissionManageMembers, PermissionManageRoles,
	PermissionCreateRoom, PermissionEditRoom, PermissionDeleteRoom, PermissionInvite,
}

var rolePermissions = map[string][]string{
	RoleOwner: {
		PermissionManageOrg, PermissionManageMembers, PermissionManageRoles,
		PermissionCreateRoom, PermissionEditRoom, PermissionDeleteRoom, PermissionInvite,
	},
	RoleAdmin: {
		PermissionManageOrg, PermissionManageMembers, PermissionManageRoles,
		PermissionCreateRoom, PermissionEditRoom, PermissionDeleteRoom, PermissionInvite,
	},
	RoleMember: {PermissionInvite},
}

func RoleHasPermission(role string, permission string) bool {
	if role == "" {
		role = RoleMember
	}
	perms, ok := rolePermissions[role]
	if !ok {
		return false
	}
	for _, p := range perms {
		if p == permission {
			return true
		}
	}
	return false
}

func ValidRole(role string) bool {
	switch role {
	case RoleOwner, RoleAdmin, RoleMember:
		return true
	default:
		return false
	}
}

func AssignableRoles(callerRole string) []string {
	switch callerRole {
	case RoleOwner:
		return []string{RoleAdmin, RoleMember}
	case RoleAdmin:
		return []string{RoleMember}
	default:
		return nil
	}
}

func ValidPermission(permission string) bool {
	for _, p := range allPermissions {
		if p == permission {
			return true
		}
	}
	return false
}
