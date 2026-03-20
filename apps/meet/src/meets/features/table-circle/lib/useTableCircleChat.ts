import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { RoomEvent } from "livekit-client";
import type { LocalParticipant, RemoteParticipant, Room as LiveKitRoom } from "livekit-client";

const DATA_TOPIC = "table_circle_chat";
const MAX_MESSAGE_LEN = 2000;

export type TableCircleChatMessageId = string;

export interface TableCircleChatMessage {
  id: TableCircleChatMessageId;
  ts: number;
  senderIdentity: string;
  text: string;
}

type TableCircleChatState = {
  messages: TableCircleChatMessage[];
};

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mergeMessagesById(current: TableCircleChatMessage[], incoming: TableCircleChatMessage[]) {
  const map = new Map<TableCircleChatMessageId, TableCircleChatMessage>();
  for (const m of current) map.set(m.id, m);
  for (const m of incoming) map.set(m.id, m);
  const merged = Array.from(map.values());
  merged.sort((a, b) => a.ts - b.ts);
  return merged;
}

export function useTableCircleChat(
  localParticipant: () => LocalParticipant | null,
  livekitRoom: () => LiveKitRoom | null,
  options?: {
    maxLog?: number;
  },
) {
  const maxLog = options?.maxLog ?? 200;

  const messages = ref<TableCircleChatMessage[]>([]);
  const stateSynced = ref(false);

  const canSend = computed(() => !!localParticipant() && !!livekitRoom());

  const trimLog = (list: TableCircleChatMessage[]) =>
    list.length <= maxLog ? list : list.slice(list.length - maxLog);

  const pushLocal = (entry: TableCircleChatMessage) => {
    messages.value = trimLog(mergeMessagesById(messages.value, [entry]));
  };

  const publishMessage = (entry: TableCircleChatMessage) => {
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

  const broadcastState = () => {
    const local = localParticipant();
    const room = livekitRoom();
    if (!local || !room) return;

    const state: TableCircleChatState = { messages: messages.value };
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

  const initDataChannel = () => {
    const room = livekitRoom();
    if (!room) return () => {};

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
          broadcastState();
          return;
        }

        if (data.type === "table_circle_chat_message" && data.payload) {
          const entry = data.payload as TableCircleChatMessage;
          if (!entry.id || !entry.senderIdentity || typeof entry.text !== "string") return;
          nextTick(() => {
            messages.value = trimLog(mergeMessagesById(messages.value, [entry]));
          });
          return;
        }

        if (data.type === "table_circle_chat_state" && data.payload) {
          const state = data.payload as TableCircleChatState;
          if (!Array.isArray(state?.messages)) return;
          nextTick(() => {
            messages.value = trimLog(mergeMessagesById(messages.value, state.messages));
            stateSynced.value = true;
          });
          return;
        }
      } catch {
        // ignore
      }
    };

    room.on(RoomEvent.DataReceived, handleData);

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

    if (room.state === "connected") {
      setTimeout(() => requestState(), 400);
      setTimeout(() => (stateSynced.value = true), 900);
    } else {
      room.once("connected", () => {
        setTimeout(() => requestState(), 400);
        setTimeout(() => (stateSynced.value = true), 900);
      });
    }

    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  };

  let cleanup: (() => void) | null = null;

  watch(
    livekitRoom,
    (room) => {
      stateSynced.value = false;
      if (cleanup) {
        cleanup();
        cleanup = null;
      }
      if (room && room.state === "connected") {
        cleanup = initDataChannel();
      } else if (room) {
        room.once("connected", () => {
          cleanup = initDataChannel();
        });
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    if (cleanup) cleanup();
  });

  const send = (text: string) => {
    const local = localParticipant();
    if (!local) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const body = trimmed.slice(0, MAX_MESSAGE_LEN);

    const entry: TableCircleChatMessage = {
      id: createMessageId(),
      ts: Date.now(),
      senderIdentity: local.identity,
      text: body,
    };

    pushLocal(entry);
    publishMessage(entry);
  };

  return {
    messages: computed(() => messages.value),
    stateSynced,
    canSend,
    send,
    maxMessageLength: MAX_MESSAGE_LEN,
    rawMessages: messages,
  };
}
