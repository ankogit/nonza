import type { ApiClient } from "@shared/api";
import type {
  Room,
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

  async getToken(
    shortCode: string,
    data: RoomTokenRequest,
  ): Promise<RoomTokenResponse> {
    // Backend expects: { short_code, participant_name, participant_id? }
    return this.client.post<RoomTokenResponse>("/api/v1/tokens", {
      short_code: shortCode,
      participant_name: data.participant_name,
      participant_id: data.participant_identity,
    });
  }
}
