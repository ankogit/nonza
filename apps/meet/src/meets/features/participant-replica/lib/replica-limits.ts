export const REPLICA_TEXT_MAX_LENGTH = 100;
export const REPLICA_SEND_COOLDOWN_MS = 1000;

export function clampReplicaText(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return t.length > REPLICA_TEXT_MAX_LENGTH
    ? t.slice(0, REPLICA_TEXT_MAX_LENGTH)
    : t;
}
