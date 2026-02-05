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
  e2ee_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRoomRequest {
  name: string;
  room_type: RoomType;
  is_temporary?: boolean;
  expires_in?: string;
  e2ee_enabled?: boolean;
}

export interface RoomTokenRequest {
  participant_name: string;
  participant_identity?: string;
}

export interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface RoomTokenResponse {
  token: string;
  url: string;
  room_name?: string;
  participant_id?: string;
  encryption_key?: string;
  ice_servers?: RTCIceServer[];
}
