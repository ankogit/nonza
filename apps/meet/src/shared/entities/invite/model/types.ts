export interface Invite {
  token: string;
  organization_id: string;
  organization_name: string;
  role: string;
  reusable: boolean;
  expires_at?: string;
  already_member?: boolean;
}

export type InviteLinkType = "one_time" | "reusable";

export interface CreateInviteParams {
  role?: string;
  expires_in?: string;
  reusable?: boolean;
}
