import type { ApiClient } from "@shared/api";
import type {
  RoomGroup,
  CreateRoomGroupRequest,
  UpdateRoomGroupRequest,
} from "../model/types";

export class RoomGroupApi {
  constructor(private client: ApiClient) {}

  async listByOrganizationId(orgId: string): Promise<RoomGroup[]> {
    return this.client.get<RoomGroup[]>(
      `/api/v1/org/${orgId}/room-groups`,
    );
  }

  async create(orgId: string, data: CreateRoomGroupRequest): Promise<RoomGroup> {
    return this.client.post<RoomGroup>(
      `/api/v1/org/${orgId}/room-groups`,
      data,
    );
  }

  async update(
    orgId: string,
    groupId: string,
    data: UpdateRoomGroupRequest,
  ): Promise<RoomGroup> {
    return this.client.patch<RoomGroup>(
      `/api/v1/org/${orgId}/room-groups/${groupId}`,
      data,
    );
  }

  async delete(orgId: string, groupId: string): Promise<void> {
    await this.client.delete(
      `/api/v1/org/${orgId}/room-groups/${groupId}`,
    );
  }
}
