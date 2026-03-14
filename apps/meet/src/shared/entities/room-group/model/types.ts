export interface RoomGroup {
  id: string;
  organization_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CreateRoomGroupRequest {
  name: string;
  position?: number;
}

export interface UpdateRoomGroupRequest {
  name?: string;
  position?: number;
}
