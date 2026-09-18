import type { TableCircleChatMessage } from "./tableCircleChatTypes";
import { normalizeStoredEntry } from "./tableCircleChatSystemEvents";

const CHAT_LOG_PREFIX = "nonza_meet_table_circle_chat_log_";
const MAX_STORED = 200;

export function tableCircleChatLogKey(
  roomId: string | null | undefined,
  shortCode: string | null | undefined,
): string | null {
  const code = shortCode?.trim().toLowerCase();
  if (code) return code;
  const id = roomId?.trim();
  return id || null;
}

function readKey(key: string): TableCircleChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_LOG_PREFIX + key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: TableCircleChatMessage[] = [];
    for (const item of parsed) {
      const entry = normalizeStoredEntry(item);
      if (entry) out.push(entry);
    }
    return out.slice(-MAX_STORED);
  } catch {
    return [];
  }
}

function mergeById(
  current: TableCircleChatMessage[],
  incoming: TableCircleChatMessage[],
): TableCircleChatMessage[] {
  const map = new Map<string, TableCircleChatMessage>();
  for (const m of current) map.set(m.id, m);
  for (const m of incoming) map.set(m.id, m);
  const merged = Array.from(map.values());
  merged.sort((a, b) => a.ts - b.ts);
  return merged;
}

export function readTableCircleChatLog(
  roomId: string | null | undefined,
  shortCode?: string | null | undefined,
): TableCircleChatMessage[] {
  const keys: string[] = [];
  const primary = tableCircleChatLogKey(roomId, shortCode);
  if (primary) keys.push(primary);
  const id = roomId?.trim();
  if (id && !keys.includes(id)) keys.push(id);

  let merged: TableCircleChatMessage[] = [];
  for (const key of keys) {
    merged = mergeById(merged, readKey(key));
  }
  return merged.slice(-MAX_STORED);
}

export function writeTableCircleChatLog(
  roomId: string | null | undefined,
  messages: TableCircleChatMessage[],
  shortCode?: string | null | undefined,
): void {
  const key = tableCircleChatLogKey(roomId, shortCode);
  if (!key) return;
  const payload = messages.slice(-MAX_STORED);
  try {
    localStorage.setItem(CHAT_LOG_PREFIX + key, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  const id = roomId?.trim();
  if (id && id !== key) {
    try {
      localStorage.removeItem(CHAT_LOG_PREFIX + id);
    } catch {
      /* ignore */
    }
  }
}
