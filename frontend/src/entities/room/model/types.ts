import type { RoomType } from "@shared/lib";

export interface Room {
  id: string;
  organization_id: string;
  name: string;
  short_code: string | null;
  room_type: RoomType;
  is_temporary: boolean;
  expires_at: string | null;
  livekit_room_name: string;
  created_at: string;
  updated_at: string;
}

export interface CreateRoomRequest {
  name: string;
  room_type: RoomType;
  is_temporary?: boolean;
  expires_in?: string;
}

export interface RoomTokenRequest {
  participant_name: string;
  participant_identity?: string;
}

export interface RoomTokenResponse {
  token: string;
  url: string;
  room_name?: string;
  participant_id?: string;
}
