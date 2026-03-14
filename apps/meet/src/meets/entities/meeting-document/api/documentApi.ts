import type { ApiClient } from "@shared/api";
import type { MeetingDocument } from "../model/types";

export class DocumentApi {
  constructor(private client: ApiClient) {}

  async getByRoomId(roomId: string): Promise<MeetingDocument> {
    return this.client.get<MeetingDocument>(`/api/v1/rooms/${roomId}/document`);
  }

  async createOrUpdate(
    roomId: string,
    data: { title: string; content: string },
  ): Promise<MeetingDocument> {
    return this.client.post<MeetingDocument>(
      `/api/v1/rooms/${roomId}/document`,
      data,
    );
  }
}
