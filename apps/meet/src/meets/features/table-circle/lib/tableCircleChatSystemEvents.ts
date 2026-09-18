import type {
  TableCircleChatMessage,
  TableCircleChatSystemEntry,
  TableCircleSystemEvent,
} from "./tableCircleChatTypes";

export type SystemEventPresentation = {
  actionLabel: string;
  pillVariant: "join" | "left" | "neutral";
};

const PRESENTATION: Record<
  TableCircleSystemEvent["type"],
  (ev: TableCircleSystemEvent) => SystemEventPresentation
> = {
  participant_joined: () => ({
    actionLabel: "зашёл",
    pillVariant: "join",
  }),
  participant_left: () => ({
    actionLabel: "вышел",
    pillVariant: "left",
  }),
};

export function getSystemEventPresentation(
  system: TableCircleSystemEvent,
): SystemEventPresentation {
  const fn = PRESENTATION[system.type];
  return fn ? fn(system) : { actionLabel: system.type, pillVariant: "neutral" };
}

export function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function systemEntryId(
  type: TableCircleSystemEvent["type"],
  identity: string,
  ts: number,
): string {
  const bucketTs = Math.floor(ts / 5000) * 5000;
  return `sys:${type}:${identity}:${bucketTs}`;
}

export function alignedSystemEventTs(ts = Date.now()): number {
  return Math.floor(ts / 5000) * 5000;
}

export function createParticipantJoinedEntry(
  identity: string,
  label: string,
  ts = alignedSystemEventTs(),
): TableCircleChatSystemEntry {
  const system: TableCircleSystemEvent = {
    type: "participant_joined",
    identity,
    displayName: label,
  };
  return {
    id: systemEntryId(system.type, identity, ts),
    ts,
    kind: "system",
    system,
    senderIdentity: identity,
    text: `${label} зашёл`,
  };
}

export function createParticipantLeftEntry(
  identity: string,
  label: string,
  ts = alignedSystemEventTs(),
): TableCircleChatSystemEntry {
  const system: TableCircleSystemEvent = {
    type: "participant_left",
    identity,
    displayName: label,
  };
  return {
    id: systemEntryId(system.type, identity, ts),
    ts,
    kind: "system",
    system,
    senderIdentity: identity,
    text: `${label} вышел`,
  };
}

export function appendSystemEvent(
  log: TableCircleChatMessage[],
  entry: TableCircleChatSystemEntry,
): TableCircleChatMessage[] {
  return [...log, entry];
}

export function isParticipantCurrentlyPresentInLog(
  log: TableCircleChatMessage[],
  identity: string,
): boolean {
  let present = false;
  for (const m of log) {
    if (m.kind !== "system") continue;
    const ev = m.system;
    if (!ev || ev.identity !== identity) continue;
    if (ev.type === "participant_joined") present = true;
    if (ev.type === "participant_left") present = false;
  }
  return present;
}

export function normalizeStoredEntry(raw: unknown): TableCircleChatMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (
    typeof m.id !== "string" ||
    typeof m.ts !== "number" ||
    typeof m.senderIdentity !== "string" ||
    typeof m.text !== "string"
  ) {
    return null;
  }

  if (m.kind === "user") {
    const senderDisplayName =
      typeof m.senderDisplayName === "string" ? m.senderDisplayName : undefined;
    return {
      id: m.id,
      ts: m.ts,
      kind: "user",
      senderIdentity: m.senderIdentity,
      senderDisplayName,
      text: m.text,
    };
  }

  if (m.kind === "system" && m.system && typeof m.system === "object") {
    const sys = m.system as {
      type?: string;
      identity?: string;
      displayName?: string;
    };
    if (
      (sys.type === "participant_joined" || sys.type === "participant_left") &&
      typeof sys.identity === "string"
    ) {
      return {
        id: m.id,
        ts: m.ts,
        kind: "system",
        system: {
          type: sys.type,
          identity: sys.identity,
          displayName:
            typeof sys.displayName === "string" ? sys.displayName : undefined,
        } as TableCircleSystemEvent,
        senderIdentity: m.senderIdentity,
        text: m.text,
      };
    }
  }

  const legacyAction = m.systemAction;
  if (legacyAction === "joined" || legacyAction === "left") {
    const type =
      legacyAction === "joined" ? "participant_joined" : "participant_left";
    return {
      id: m.id,
      ts: m.ts,
      kind: "system",
      system: { type, identity: m.senderIdentity, displayName: undefined },
      senderIdentity: m.senderIdentity,
      text: m.text,
    };
  }

  if (/\sзашёл\s*$/u.test(m.text)) {
    return createParticipantJoinedEntry(
      m.senderIdentity,
      m.text.replace(/\sзашёл\s*$/u, "").trim() || m.senderIdentity,
      m.ts,
    );
  }
  if (/\sвышел\s*$/u.test(m.text)) {
    return createParticipantLeftEntry(
      m.senderIdentity,
      m.text.replace(/\sвышел\s*$/u, "").trim() || m.senderIdentity,
      m.ts,
    );
  }

  return null;
}
