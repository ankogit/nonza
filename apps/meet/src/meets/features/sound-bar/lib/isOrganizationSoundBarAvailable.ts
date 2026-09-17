import type { Room } from "@shared/entities";

type RoomSoundBarFields = Pick<Room, "organization_id" | "sound_bar_available">;

export function isOrganizationSoundBarAvailable(
  room: RoomSoundBarFields | null | undefined,
): boolean {
  if (!room?.organization_id?.trim()) return false;
  if (typeof room.sound_bar_available === "boolean") {
    return room.sound_bar_available;
  }
  return true;
}
