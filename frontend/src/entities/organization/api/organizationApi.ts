import type { ApiClient } from "@shared/api";
import type {
  Organization,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
} from "../model/types";

export class OrganizationApi {
  constructor(private client: ApiClient) {}

  async create(data: CreateOrganizationRequest): Promise<Organization> {
    return this.client.post<Organization>("/api/v1/organizations", data);
  }

  async getById(id: string): Promise<Organization> {
    return this.client.get<Organization>(`/api/v1/organizations/${id}`);
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
}
