import type { ApiClient } from "@shared/api";
import type { Invite } from "../model/types";

export class InviteApi {
  constructor(private client: ApiClient) {}

  async create(orgId: string): Promise<Invite> {
    return this.client.post<Invite>(`/api/v1/org/${orgId}/invites`, {});
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
