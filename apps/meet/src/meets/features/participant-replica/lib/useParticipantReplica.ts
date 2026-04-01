import { ref, computed, watch, onUnmounted, type Ref } from "vue";
import { RoomEvent } from "livekit-client";
import type { Room, RemoteParticipant } from "livekit-client";
import { playNotificationSound, isReplicaTtsMutedIdentity } from "@shared/lib";
import {
  clampReplicaText,
  REPLICA_SEND_COOLDOWN_MS,
} from "./replica-limits";

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

export interface UseParticipantReplicaOptions {
  /** Играть звук нового сообщения при получении только если отправитель в этом списке (например, поднял руку). Не передавать = играть всегда. */
  raisedHands?: () => string[];
  /** Опционально: озвучить текст реплики при получении/отправке. */
  speakReplica?: (text: string, meta: { identity: string; isLocal: boolean }) => void;
}

export function useParticipantReplica(
  room: Ref<Room | null>,
  options?: UseParticipantReplicaOptions,
) {
  const replicaByIdentity = ref<Record<string, ReplicaMessage>>({});
  let lastReplicaSendAt = 0;

  const replicaByParticipant = computed(() => replicaByIdentity.value);

  function sendReplica(text: string): boolean {
    const r = room.value;
    if (!r?.localParticipant) return false;
    const identity = r.localParticipant.identity;
    const normalized = clampReplicaText(text);

    if (!normalized) {
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
      return true;
    }

    const now = Date.now();
    if (now - lastReplicaSendAt < REPLICA_SEND_COOLDOWN_MS) return false;
    lastReplicaSendAt = now;

    const msg: ReplicaMessage = { text: normalized, ts: now };
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

    playNotificationSound("message").catch(() => {});
    options?.speakReplica?.(msg.text, { identity, isLocal: true });
    return true;
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
      const normalized = clampReplicaText(msg.text);
      const remoteMuted = isReplicaTtsMutedIdentity(participant.identity);
      if (normalized !== "") {
        const raised = options?.raisedHands?.();
        const shouldPlay = !raised || raised.includes(participant.identity);
        if (shouldPlay && !remoteMuted) {
          playNotificationSound("message").catch(() => {});
          options?.speakReplica?.(normalized, {
            identity: participant.identity,
            isLocal: false,
          });
        }
      }
      const next = { ...replicaByIdentity.value };
      if (normalized === "") {
        delete next[participant.identity];
      } else {
        next[participant.identity] = { text: normalized, ts: msg.ts };
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
