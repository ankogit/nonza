export type TableCircleChatMessageId = string;

export interface TableCircleChatUserEntry {
  id: TableCircleChatMessageId;
  ts: number;
  kind: "user";
  senderIdentity: string;
  senderDisplayName?: string;
  text: string;
}

export interface TableCircleSystemEventBase {
  identity: string;
  displayName?: string;
}

export interface TableCircleSystemParticipantJoined extends TableCircleSystemEventBase {
  type: "participant_joined";
}

export interface TableCircleSystemParticipantLeft extends TableCircleSystemEventBase {
  type: "participant_left";
}

export type TableCircleSystemEvent =
  | TableCircleSystemParticipantJoined
  | TableCircleSystemParticipantLeft;

export interface TableCircleChatSystemEntry {
  id: TableCircleChatMessageId;
  ts: number;
  kind: "system";
  system: TableCircleSystemEvent;
  senderIdentity: string;
  text: string;
}

export type TableCircleChatMessage =
  | TableCircleChatUserEntry
  | TableCircleChatSystemEntry;

export type TableCircleChatMessageKind = TableCircleChatMessage["kind"];

export function isUserEntry(
  m: TableCircleChatMessage,
): m is TableCircleChatUserEntry {
  return m.kind === "user";
}

export function isSystemEntry(
  m: TableCircleChatMessage,
): m is TableCircleChatSystemEntry {
  return m.kind === "system";
}

export function chatEntryDisplayName(
  m: TableCircleChatMessage,
  resolveIdentity: (identity: string) => string,
): string {
  if (m.kind === "user" && m.senderDisplayName?.trim()) {
    return m.senderDisplayName.trim();
  }
  if (m.kind === "system" && m.system.displayName?.trim()) {
    return m.system.displayName.trim();
  }
  if (m.kind === "system") {
    const fromText = m.text
      .replace(/\s(зашёл|вышел)\s*$/u, "")
      .trim();
    if (fromText && fromText !== m.senderIdentity) return fromText;
  }
  return resolveIdentity(m.senderIdentity);
}
