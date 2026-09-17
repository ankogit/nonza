import type { ApiClient } from "@shared/api";
import type { CreateInviteParams, Invite } from "../model/types";

export class InviteApi {
  constructor(private client: ApiClient) {}

  async create(orgId: string, params: CreateInviteParams = {}): Promise<Invite> {
    return this.client.post<Invite>(`/api/v1/org/${orgId}/invites`, {
      role: params.role,
      expires_in: params.expires_in,
      reusable: params.reusable ?? false,
    });
  }

  async getByToken(token: string): Promise<Invite> {
    return this.client.get<Invite>(`/api/v1/invites/${encodeURIComponent(token)}`);
  }

  async accept(
    token: string,
    body?: { color?: string | null },
  ): Promise<{ status: string }> {
    return this.client.post<{ status: string }>(
      `/api/v1/invites/${encodeURIComponent(token)}/accept`,
      body ?? {},
    );
  }
}
