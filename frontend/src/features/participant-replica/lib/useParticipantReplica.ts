import { ref, computed, watch, onUnmounted, type Ref } from "vue";
import { RoomEvent } from "livekit-client";
import type { Room, RemoteParticipant } from "livekit-client";

const REPLICA_TOPIC = "participant-replica";

export interface ReplicaMessage {
  text: string;
  ts: number;
}

function encodePayload(text: string, ts: number): Uint8Array {
  const payload = JSON.stringify({ type: REPLICA_TOPIC, text, ts });
  return new TextEncoder().encode(payload);
}

function decodePayload(payload: Uint8Array): ReplicaMessage | null {
  try {
    const raw = new TextDecoder().decode(payload);
    const data = JSON.parse(raw) as {
      type?: string;
      text?: string;
      ts?: number;
    };
    if (data?.type !== REPLICA_TOPIC || typeof data?.text !== "string")
      return null;
    return {
      text: data.text,
      ts: typeof data.ts === "number" ? data.ts : Date.now(),
    };
  } catch {
    return null;
  }
}

export function useParticipantReplica(room: Ref<Room | null>) {
  const replicaByIdentity = ref<Record<string, ReplicaMessage>>({});

  const replicaByParticipant = computed(() => replicaByIdentity.value);

  function sendReplica(text: string): void {
    const r = room.value;
    if (!r?.localParticipant) return;
    const trimmed = text.trim();
    const identity = r.localParticipant.identity;

    if (!trimmed) {
      const next = { ...replicaByIdentity.value };
      delete next[identity];
      replicaByIdentity.value = next;
      r.localParticipant
        .publishData(encodePayload("", Date.now()), {
          reliable: true,
          topic: REPLICA_TOPIC,
        })
        .catch((err) =>
          console.error("[participant-replica] send failed:", err),
        );
      return;
    }

    const msg: ReplicaMessage = { text: trimmed, ts: Date.now() };
    replicaByIdentity.value = {
      ...replicaByIdentity.value,
      [identity]: msg,
    };

    r.localParticipant
      .publishData(encodePayload(msg.text, msg.ts), {
        reliable: true,
        topic: REPLICA_TOPIC,
      })
      .catch((err) => console.error("[participant-replica] send failed:", err));
  }

  const offDataReceived = ref<(() => void) | null>(null);

  function setupListener(r: Room | null): void {
    offDataReceived.value?.();
    if (!r) return;
    const handler = (
      payload: Uint8Array,
      participant?: RemoteParticipant,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic !== REPLICA_TOPIC || !participant) return;
      const msg = decodePayload(payload);
      if (!msg) return;
      const next = { ...replicaByIdentity.value };
      if (msg.text.trim() === "") {
        delete next[participant.identity];
      } else {
        next[participant.identity] = msg;
      }
      replicaByIdentity.value = next;
    };
    r.on(RoomEvent.DataReceived, handler);
    offDataReceived.value = () => r.off(RoomEvent.DataReceived, handler);
  }

  watch(
    room,
    (r) => {
      setupListener(r ?? null);
      if (!r) replicaByIdentity.value = {};
    },
    { immediate: true },
  );

  onUnmounted(() => {
    offDataReceived.value?.();
  });

  return {
    replicaByParticipant,
    sendReplica,
  };
}
