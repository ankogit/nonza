import type { Room } from "@shared/entities";

type RoomSoundBarFields = Pick<
  Room,
  "organization_id" | "created_by_user_id" | "allow_anonymous_join"
>;

export function isOrganizationSoundBarAvailable(
  room: RoomSoundBarFields | null | undefined,
): boolean {
  if (!room?.organization_id?.trim()) return false;
  if (room.created_by_user_id?.trim()) return true;
  return room.allow_anonymous_join === false;
}
