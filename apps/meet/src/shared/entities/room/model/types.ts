import type { RoomType } from "@shared/lib";

export interface Room {
  id: string;
  organization_id: string;
  room_group_id?: string | null;
  name: string;
  short_code: string | null;
  room_type: RoomType;
  is_temporary: boolean;
  expires_at: string | null;
  livekit_room_name: string;
  e2ee_enabled: boolean;
  conference_hall_leader_id?: string | null;
  allow_anonymous_join?: boolean;
  position?: number;
  created_at: string;
  updated_at: string;
  current_user_org_color?: string | null;
}

export interface Participant {
  identity: string;
  name: string;
}

export type RoomWithParticipants = Room & {
  participants?: Participant[];
};

export interface CreateRoomRequest {
  name: string;
  room_type: RoomType;
  is_temporary?: boolean;
  expires_in?: string;
  e2ee_enabled?: boolean;
  room_group_id?: string | null;
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
