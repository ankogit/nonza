import type { InjectionKey } from "vue";
import type { MeetRoomCollaborationBundle } from "./model/types";

export const MEET_ROOM_COLLABORATION_KEY: InjectionKey<MeetRoomCollaborationBundle> =
  Symbol("meetRoomCollaboration");
