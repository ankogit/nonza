import { ROOM_TYPES, type RoomType } from "./constants";

export type DisplayRoomType = "conference_hall" | "round_table";

export function resolveDisplayRoomType(
  room: { room_type?: RoomType | null } | null,
  hint?: RoomType | null
): DisplayRoomType | null {
  const rawFromRoom =
    room?.room_type != null
      ? String(room.room_type).trim().toLowerCase().replace(/-/g, "_")
      : null;
  const rawFromHint =
    hint != null
      ? String(hint).trim().toLowerCase().replace(/-/g, "_")
      : null;
  const raw = (rawFromRoom ?? rawFromHint) || null;
  const result =
    !raw ? null
    : raw === ROOM_TYPES.CONFERENCE_HALL ? "conference_hall"
    : raw === ROOM_TYPES.ROUND_TABLE ? "round_table"
    : null;
  return result;
}
