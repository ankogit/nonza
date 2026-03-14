export const ORG_ROLE_OWNER = "owner";
export const ORG_ROLE_ADMIN = "admin";
export const ORG_ROLE_MEMBER = "member";

export const ORG_ROLES = [ORG_ROLE_OWNER, ORG_ROLE_ADMIN, ORG_ROLE_MEMBER] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const ORG_PERMISSION_MANAGE_ORG = "manage_org";
export const ORG_PERMISSION_MANAGE_MEMBERS = "manage_members";
export const ORG_PERMISSION_MANAGE_ROLES = "manage_roles";
export const ORG_PERMISSION_CREATE_ROOM = "create_room";
export const ORG_PERMISSION_EDIT_ROOM = "edit_room";
export const ORG_PERMISSION_DELETE_ROOM = "delete_room";
export const ORG_PERMISSION_INVITE = "invite";

export type OrgPermission =
  | typeof ORG_PERMISSION_MANAGE_ORG
  | typeof ORG_PERMISSION_MANAGE_MEMBERS
  | typeof ORG_PERMISSION_MANAGE_ROLES
  | typeof ORG_PERMISSION_CREATE_ROOM
  | typeof ORG_PERMISSION_EDIT_ROOM
  | typeof ORG_PERMISSION_DELETE_ROOM
  | typeof ORG_PERMISSION_INVITE;

const ROLE_PERMISSIONS: Record<string, OrgPermission[]> = {
  [ORG_ROLE_OWNER]: [
    ORG_PERMISSION_MANAGE_ORG,
    ORG_PERMISSION_MANAGE_MEMBERS,
    ORG_PERMISSION_MANAGE_ROLES,
    ORG_PERMISSION_CREATE_ROOM,
    ORG_PERMISSION_EDIT_ROOM,
    ORG_PERMISSION_DELETE_ROOM,
    ORG_PERMISSION_INVITE,
  ],
  [ORG_ROLE_ADMIN]: [
    ORG_PERMISSION_MANAGE_ORG,
    ORG_PERMISSION_MANAGE_MEMBERS,
    ORG_PERMISSION_MANAGE_ROLES,
    ORG_PERMISSION_CREATE_ROOM,
    ORG_PERMISSION_EDIT_ROOM,
    ORG_PERMISSION_DELETE_ROOM,
    ORG_PERMISSION_INVITE,
  ],
  [ORG_ROLE_MEMBER]: [ORG_PERMISSION_INVITE],
};

export function canRole(role: string, permission: OrgPermission): boolean {
  const normalized = role?.toLowerCase() || ORG_ROLE_MEMBER;
  const perms = ROLE_PERMISSIONS[normalized];
  if (!perms) return false;
  return perms.includes(permission);
}

const ASSIGNABLE_BY_OWNER: OrgRole[] = [ORG_ROLE_ADMIN, ORG_ROLE_MEMBER];
const ASSIGNABLE_BY_ADMIN: OrgRole[] = [ORG_ROLE_MEMBER];

export function assignableRoles(callerRole: string): OrgRole[] {
  const r = callerRole?.toLowerCase();
  if (r === ORG_ROLE_OWNER) return ASSIGNABLE_BY_OWNER;
  if (r === ORG_ROLE_ADMIN) return ASSIGNABLE_BY_ADMIN;
  return [];
}

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  [ORG_ROLE_OWNER]: "Владелец",
  [ORG_ROLE_ADMIN]: "Админ",
  [ORG_ROLE_MEMBER]: "Участник",
};
