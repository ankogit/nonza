import type { ApiClient } from "@shared/api";
import type {
  Organization,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  OrganizationMember,
} from "../model/types";

export class OrganizationApi {
  constructor(private client: ApiClient) {}

  async create(data: CreateOrganizationRequest): Promise<Organization> {
    return this.client.post<Organization>("/api/v1/organizations", data);
  }

  async getById(id: string): Promise<Organization> {
    return this.client.get<Organization>(`/api/v1/organizations/${id}`);
  }

  async getList(): Promise<Organization[]> {
    return this.client.get<Organization[]>("/api/v1/organizations");
  }

  async update(
    id: string,
    data: UpdateOrganizationRequest,
  ): Promise<Organization> {
    return this.client.put<Organization>(`/api/v1/organizations/${id}`, data);
  }

  async delete(id: string): Promise<void> {
    return this.client.delete<void>(`/api/v1/organizations/${id}`);
  }

  async getMembers(orgId: string): Promise<OrganizationMember[]> {
    return this.client.get<OrganizationMember[]>(`/api/v1/org/${orgId}/members`);
  }

  async updateMemberRole(
    orgId: string,
    userId: string,
    role: string,
  ): Promise<void> {
    await this.client.patch<void>(`/api/v1/org/${orgId}/members/${encodeURIComponent(userId)}`, { role });
  }

  async updateMyMemberColor(
    orgId: string,
    data: { color?: string | null },
  ): Promise<void> {
    await this.client.patch<void>(`/api/v1/org/${orgId}/members/me`, data);
  }

  async removeMember(orgId: string, userId: string): Promise<void> {
    await this.client.delete<void>(`/api/v1/org/${orgId}/members/${encodeURIComponent(userId)}`);
  }
}
