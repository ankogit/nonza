import { computed, nextTick, onUnmounted, ref, watch, type Ref } from "vue";
import { RoomEvent } from "livekit-client";
import type {
  LocalParticipant,
  RemoteParticipant,
  Room as LiveKitRoom,
} from "livekit-client";
import { playNotificationSound, getRoomShortCode } from "@shared/lib";
import {
  readTableCircleChatLog,
  writeTableCircleChatLog,
  tableCircleChatLogKey,
} from "./tableCircleChatLogStorage";
import type {
  TableCircleChatMessage,
  TableCircleChatMessageId,
  TableCircleChatSystemEntry,
  TableCircleChatUserEntry,
} from "./tableCircleChatTypes";
import {
  createMessageId,
  createParticipantJoinedEntry,
  createParticipantLeftEntry,
  isParticipantCurrentlyPresentInLog,
  normalizeStoredEntry,
} from "./tableCircleChatSystemEvents";

const DATA_TOPIC = "table_circle_chat";
const MAX_MESSAGE_LEN = 2000;

type TableCircleChatState = {
  messages: TableCircleChatMessage[];
};

type StorageKeyFn = () => {
  id: string | null | undefined;
  shortCode: string | null | undefined;
};

type ChatSession = {
  messages: Ref<TableCircleChatMessage[]>;
  stateSynced: Ref<boolean>;
  refCount: number;
  listenersAttached: boolean;
  cleanup: (() => void) | null;
  getStorageKey: StorageKeyFn;
};

const sessions = new WeakMap<LiveKitRoom, ChatSession>();

function mergeMessagesById(
  current: TableCircleChatMessage[],
  incoming: TableCircleChatMessage[],
) {
  const map = new Map<TableCircleChatMessageId, TableCircleChatMessage>();
  for (const m of current) map.set(m.id, m);
  for (const m of incoming) map.set(m.id, m);
  const merged = Array.from(map.values());
  merged.sort((a, b) => a.ts - b.ts);
  return merged;
}

function participantLabel(p: RemoteParticipant | LocalParticipant) {
  const name = (p.name ?? "").trim();
  return name || p.identity;
}

function defaultDisplayName(p: RemoteParticipant | LocalParticipant) {
  return participantLabel(p);
}

function parseStateMessages(raw: unknown): TableCircleChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: TableCircleChatMessage[] = [];
  for (const item of raw) {
    const normalized = normalizeStoredEntry(item);
    if (normalized) {
      out.push(normalized);
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    if (
      typeof m.id === "string" &&
      typeof m.ts === "number" &&
      typeof m.senderIdentity === "string" &&
      typeof m.text === "string"
    ) {
      out.push({
        id: m.id,
        ts: m.ts,
        senderIdentity: m.senderIdentity,
        text: m.text,
        kind: "user",
        ...(typeof m.senderDisplayName === "string"
          ? { senderDisplayName: m.senderDisplayName }
          : {}),
      });
    }
  }
  return out;
}

export type {
  TableCircleChatMessage,
  TableCircleChatMessageId,
  TableCircleChatMessageKind,
  TableCircleChatSystemEntry,
  TableCircleChatUserEntry,
  TableCircleSystemEvent,
} from "./tableCircleChatTypes";

function getOrCreateSession(room: LiveKitRoom): ChatSession {
  let session = sessions.get(room);
  if (!session) {
    session = {
      messages: ref<TableCircleChatMessage[]>([]),
      stateSynced: ref(false),
      refCount: 0,
      listenersAttached: false,
      cleanup: null,
      getStorageKey: () => ({ id: undefined, shortCode: undefined }),
    };
    sessions.set(room, session);
  }
  return session;
}

function persistSessionMessages(session: ChatSession) {
  const { id, shortCode } = session.getStorageKey();
  writeTableCircleChatLog(id, session.messages.value, shortCode);
}

export function useTableCircleChat(
  localParticipant: () => LocalParticipant | null,
  livekitRoom: () => LiveKitRoom | null,
  options?: {
    maxLog?: number;
    roomId?: () => string | null | undefined;
    roomShortCode?: () => string | null | undefined;
    participantDisplayName?: (
      p: RemoteParticipant | LocalParticipant,
    ) => string;
  },
) {
  const maxLog = options?.maxLog ?? 200;
  const roomId = options?.roomId ?? (() => undefined);
  const roomShortCode = options?.roomShortCode ?? (() => undefined);
  const labelFor = options?.participantDisplayName ?? defaultDisplayName;

  const storageKey: StorageKeyFn = () => ({
    id: roomId(),
    shortCode: roomShortCode() ?? getRoomShortCode(),
  });

  const fallbackMessages = ref<TableCircleChatMessage[]>([]);
  const fallbackSynced = ref(false);
  let activeSession: ChatSession | null = null;

  const messages = computed(() =>
    activeSession ? activeSession.messages.value : fallbackMessages.value,
  );
  const stateSynced = computed(() =>
    activeSession ? activeSession.stateSynced.value : fallbackSynced.value,
  );

  const canSend = computed(() => !!localParticipant() && !!livekitRoom());

  const trimLog = (list: TableCircleChatMessage[]) =>
    list.length <= maxLog ? list : list.slice(list.length - maxLog);

  const hydrateSessionFromStorage = (session: ChatSession) => {
    const { id, shortCode } = session.getStorageKey();
    if (!tableCircleChatLogKey(id, shortCode)) return;
    const stored = readTableCircleChatLog(id, shortCode);
    if (stored.length === 0) return;
    session.messages.value = trimLog(
      mergeMessagesById(session.messages.value, stored),
    );
  };

  const mutateMessages = (
    updater: (current: TableCircleChatMessage[]) => TableCircleChatMessage[],
  ) => {
    if (activeSession) {
      activeSession.messages.value = trimLog(
        updater(activeSession.messages.value),
      );
      persistSessionMessages(activeSession);
      return;
    }
    fallbackMessages.value = trimLog(updater(fallbackMessages.value));
    const { id, shortCode } = storageKey();
    writeTableCircleChatLog(id, fallbackMessages.value, shortCode);
  };

  const pushLocal = (entry: TableCircleChatMessage) => {
    mutateMessages((current) => mergeMessagesById(current, [entry]));
  };

  const publishMessage = (entry: TableCircleChatUserEntry) => {
    const local = localParticipant();
    const room = livekitRoom();
    if (!local || !room) return;

    const payload = JSON.stringify({
      type: "table_circle_chat_message",
      payload: entry,
    });

    local
      .publishData(new TextEncoder().encode(payload), {
        reliable: true,
        topic: DATA_TOPIC,
      })
      .catch(() => {});
  };

  const broadcastStateFor = (session: ChatSession) => {
    const local = localParticipant();
    const room = livekitRoom();
    if (!local || !room) return;

    const state: TableCircleChatState = {
      messages: session.messages.value,
    };
    const payload = JSON.stringify({
      type: "table_circle_chat_state",
      payload: state,
    });

    local
      .publishData(new TextEncoder().encode(payload), {
        reliable: true,
        topic: DATA_TOPIC,
      })
      .catch(() => {});
  };

  const initSessionChannel = (room: LiveKitRoom, session: ChatSession) => {
    if (session.listenersAttached) return;
    session.listenersAttached = true;

    const publishSystemEvent = (entry: TableCircleChatSystemEntry) => {
      const local = localParticipant();
      const lkRoom = livekitRoom();
      if (!local || !lkRoom) return;
      const payload = JSON.stringify({
        type: "table_circle_chat_system",
        payload: entry,
      });
      local
        .publishData(new TextEncoder().encode(payload), {
          reliable: true,
          topic: DATA_TOPIC,
        })
        .catch(() => {});
    };

    const ingestEntry = (
      entry: TableCircleChatMessage,
      options?: { publishSystem?: boolean },
    ) => {
      if (session.messages.value.some((m) => m.id === entry.id)) return;
      session.messages.value = trimLog(
        mergeMessagesById(session.messages.value, [entry]),
      );
      persistSessionMessages(session);
      if (options?.publishSystem && entry.kind === "system") {
        publishSystemEvent(entry);
      }
    };

    const handleData = (
      payload: Uint8Array,
      participant?: RemoteParticipant | LocalParticipant,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic != null && topic !== DATA_TOPIC) return;
      const local = localParticipant();
      if (participant && local && participant.identity === local.identity) return;

      try {
        const data = JSON.parse(new TextDecoder().decode(payload)) as
          | { type: string; payload?: unknown }
          | undefined;
        if (!data?.type) return;

        if (data.type === "request_state") {
          broadcastStateFor(session);
          return;
        }

        if (data.type === "table_circle_chat_message" && data.payload) {
          const entry = data.payload as TableCircleChatUserEntry;
          if (!entry.id || !entry.senderIdentity || typeof entry.text !== "string")
            return;
          const alreadyHave = session.messages.value.some((m) => m.id === entry.id);
          if (!alreadyHave) {
            playNotificationSound("table_chat_message").catch(() => {});
          }
          nextTick(() => {
            ingestEntry({ ...entry, kind: "user" });
          });
          return;
        }

        if (data.type === "table_circle_chat_system" && data.payload) {
          const entry = normalizeStoredEntry(data.payload);
          if (!entry || entry.kind !== "system") return;
          nextTick(() => {
            ingestEntry(entry);
          });
          return;
        }

        if (data.type === "table_circle_chat_state" && data.payload) {
          const state = data.payload as TableCircleChatState;
          nextTick(() => {
            const incoming = parseStateMessages(state?.messages);
            session.messages.value = trimLog(
              mergeMessagesById(session.messages.value, incoming),
            );
            persistSessionMessages(session);
            session.stateSynced.value = true;
          });
          return;
        }
      } catch {
        // ignore
      }
    };

    const onJoined = (participant: RemoteParticipant) => {
      if (
        isParticipantCurrentlyPresentInLog(
          session.messages.value,
          participant.identity,
        )
      ) {
        return;
      }
      const label = labelFor(participant);
      ingestEntry(
        createParticipantJoinedEntry(participant.identity, label),
        { publishSystem: true },
      );
      setTimeout(() => broadcastStateFor(session), 350);
    };

    const onLeft = (participant: RemoteParticipant) => {
      if (
        !isParticipantCurrentlyPresentInLog(
          session.messages.value,
          participant.identity,
        )
      ) {
        return;
      }
      const label = labelFor(participant);
      ingestEntry(
        createParticipantLeftEntry(participant.identity, label),
        { publishSystem: true },
      );
      setTimeout(() => broadcastStateFor(session), 350);
    };

    room.on(RoomEvent.DataReceived, handleData);
    room.on(RoomEvent.ParticipantConnected, onJoined);
    room.on(RoomEvent.ParticipantDisconnected, onLeft);

    const requestState = () => {
      const local = localParticipant();
      if (!local) return;
      try {
        const req = JSON.stringify({ type: "request_state" });
        local
          .publishData(new TextEncoder().encode(req), {
            reliable: true,
            topic: DATA_TOPIC,
          })
          .catch(() => {});
      } catch {
        // ignore
      }
    };

    const scheduleStatePull = () => {
      for (const delay of [400, 1200, 2800]) {
        setTimeout(() => requestState(), delay);
      }
      setTimeout(() => {
        session.stateSynced.value = true;
      }, 3200);
    };

    if (room.state === "connected") {
      scheduleStatePull();
    } else {
      room.once("connected", () => {
        scheduleStatePull();
      });
    }

    const onRoomDisconnected = () => {
      persistSessionMessages(session);
      session.cleanup?.();
    };

    session.cleanup = () => {
      if (!session.listenersAttached) return;
      room.off(RoomEvent.DataReceived, handleData);
      room.off(RoomEvent.ParticipantConnected, onJoined);
      room.off(RoomEvent.ParticipantDisconnected, onLeft);
      room.off(RoomEvent.Disconnected, onRoomDisconnected);
      session.listenersAttached = false;
      session.cleanup = null;
    };

    room.on(RoomEvent.Disconnected, onRoomDisconnected);
  };

  const releaseSession = (session: ChatSession) => {
    session.refCount = Math.max(0, session.refCount - 1);
  };

  const bindRoom = (room: LiveKitRoom | null) => {
    if (activeSession) {
      releaseSession(activeSession);
      activeSession = null;
    }
    if (!room) return;

    const session = getOrCreateSession(room);
    session.getStorageKey = storageKey;
    session.refCount += 1;
    activeSession = session;
    hydrateSessionFromStorage(session);
    if (room.state === "connected") {
      initSessionChannel(room, session);
    } else {
      room.once("connected", () => {
        if (activeSession === session) initSessionChannel(room, session);
      });
    }
  };

  watch(
    () => [roomId(), roomShortCode(), getRoomShortCode()] as const,
    () => {
      if (activeSession) {
        activeSession.getStorageKey = storageKey;
        hydrateSessionFromStorage(activeSession);
      }
    },
  );

  watch(
    livekitRoom,
    (room) => {
      if (activeSession) activeSession.stateSynced.value = false;
      else fallbackSynced.value = false;
      bindRoom(room);
    },
    { immediate: true },
  );

  onUnmounted(() => {
    if (activeSession) {
      releaseSession(activeSession);
      activeSession = null;
    }
  });

  const send = (text: string) => {
    const local = localParticipant();
    if (!local) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const body = trimmed.slice(0, MAX_MESSAGE_LEN);

    const entry: TableCircleChatUserEntry = {
      id: createMessageId(),
      ts: Date.now(),
      senderIdentity: local.identity,
      senderDisplayName: labelFor(local),
      text: body,
      kind: "user",
    };

    pushLocal(entry);
    publishMessage(entry);
  };

  return {
    messages,
    stateSynced,
    canSend,
    send,
    maxMessageLength: MAX_MESSAGE_LEN,
  };
}
