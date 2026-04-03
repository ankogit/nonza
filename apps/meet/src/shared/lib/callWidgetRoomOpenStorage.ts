const TABLE_CHAT_OPEN_PREFIX = "nonza_meet_table_chat_open_";
const TABLE_DICE_OPEN_PREFIX = "nonza_meet_table_dice_open_";
const TABLE_CIRCLE_CENTER_PREFIX = "nonza_meet_table_circle_center_";

export type TableCircleCenterMode = "chat" | "dice" | "stream";

export function readTableChatOpenForRoom(
  roomId: string | undefined | null,
): boolean {
  if (!roomId) return false;
  try {
    return localStorage.getItem(TABLE_CHAT_OPEN_PREFIX + roomId) === "1";
  } catch {
    return false;
  }
}

export function writeTableChatOpenForRoom(
  roomId: string | undefined | null,
  open: boolean,
): void {
  if (!roomId) return;
  try {
    localStorage.setItem(TABLE_CHAT_OPEN_PREFIX + roomId, open ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function readTableDiceOpenForRoom(
  roomId: string | undefined | null,
): boolean {
  if (!roomId) return false;
  try {
    return localStorage.getItem(TABLE_DICE_OPEN_PREFIX + roomId) === "1";
  } catch {
    return false;
  }
}

export function writeTableDiceOpenForRoom(
  roomId: string | undefined | null,
  open: boolean,
): void {
  if (!roomId) return;
  try {
    localStorage.setItem(TABLE_DICE_OPEN_PREFIX + roomId, open ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function readTableCircleCenterForRoom(
  roomId: string | undefined | null,
): TableCircleCenterMode {
  if (!roomId) return "chat";
  try {
    const v = localStorage.getItem(TABLE_CIRCLE_CENTER_PREFIX + roomId);
    if (v === "chat" || v === "dice" || v === "stream") return v;
  } catch {
    /* ignore */
  }
  return "chat";
}

export function writeTableCircleCenterForRoom(
  roomId: string | undefined | null,
  value: TableCircleCenterMode,
): void {
  if (!roomId) return;
  try {
    localStorage.setItem(TABLE_CIRCLE_CENTER_PREFIX + roomId, value);
  } catch {
    /* ignore */
  }
}
