import type { ApiClient } from "@shared/api";
import type {
  Room,
  RoomWithParticipants,
  CreateRoomRequest,
  RoomTokenRequest,
  RoomTokenResponse,
} from "../model/types";

export class RoomApi {
  constructor(private client: ApiClient) {}

  async getByShortCode(shortCode: string): Promise<Room> {
    return this.client.get<Room>(`/api/v1/rooms/${shortCode}`);
  }

  async getById(id: string): Promise<Room> {
    return this.client.get<Room>(`/api/v1/rooms/id/${id}`);
  }

  async create(orgId: string, data: CreateRoomRequest): Promise<Room> {
    return this.client.post<Room>(`/api/v1/org/${orgId}/rooms`, data);
  }

  async listByOrganizationId(
    orgId: string,
    options?: { include?: "participants" },
  ): Promise<RoomWithParticipants[]> {
    const params =
      options?.include === "participants"
        ? new URLSearchParams({ include: "participants" })
        : undefined;
    const query = params ? `?${params}` : "";
    return this.client.get<RoomWithParticipants[]>(
      `/api/v1/org/${orgId}/rooms${query}`,
    );
  }

  async getToken(
    shortCode: string,
    data: RoomTokenRequest,
  ): Promise<RoomTokenResponse> {
    const body: Record<string, string | undefined> = {
      short_code: shortCode,
      participant_name: data.participant_name,
      participant_id: data.participant_identity,
    };
    if (data.password !== undefined) {
      body.password = data.password;
    }
    return this.client.post<RoomTokenResponse>("/api/v1/tokens", body);
  }

  async updateConferenceHallLeader(
    shortCode: string,
    leaderIdentity: string | null,
  ): Promise<Room> {
    return this.client.patch<Room>(
      `/api/v1/rooms/${shortCode}/conference-hall-leader`,
      { leader_identity: leaderIdentity },
    );
  }

  async updateSettings(
    shortCode: string,
    data: {
      allow_anonymous_join?: boolean;
      room_type?: import("@shared/lib").RoomType;
      name?: string;
      room_group_id?: string | null;
      password?: string | null;
    },
  ): Promise<Room> {
    return this.client.patch<Room>(
      `/api/v1/rooms/${shortCode}/settings`,
      data,
    );
  }

  async delete(shortCode: string): Promise<void> {
    await this.client.delete(`/api/v1/rooms/${shortCode}`);
  }

  async notifyParticipantLeft(shortCode: string): Promise<void> {
    await this.client.post(`/api/v1/rooms/${shortCode}/notify-participant-left`, {});
  }

  async updateOrder(orgId: string, roomIds: string[]): Promise<void> {
    await this.client.patch(`/api/v1/org/${orgId}/rooms/order`, { order: roomIds });
  }
}
