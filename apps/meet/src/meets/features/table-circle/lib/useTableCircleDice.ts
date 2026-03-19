import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { RoomEvent } from "livekit-client";
import type { LocalParticipant, RemoteParticipant, Room as LiveKitRoom } from "livekit-client";
import { rollDiceExpression, type DiceRollMode, type DiceRollResult } from "@shared/lib";

const DATA_TOPIC = "table_circle_dice";

export type TableCircleDiceRollId = string;

export interface TableCircleDiceRollEntry extends DiceRollResult {
  id: TableCircleDiceRollId;
  ts: number;
  rollerIdentity: string;
  d20Mode: DiceRollMode;
}

type TableCircleDiceState = {
  rolls: TableCircleDiceRollEntry[];
};

function createRollId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mergeRollsById(current: TableCircleDiceRollEntry[], incoming: TableCircleDiceRollEntry[]) {
  const map = new Map<TableCircleDiceRollId, TableCircleDiceRollEntry>();
  for (const r of current) map.set(r.id, r);
  for (const r of incoming) map.set(r.id, r);
  const merged = Array.from(map.values());
  merged.sort((a, b) => b.ts - a.ts);
  return merged;
}

export function useTableCircleDice(
  localParticipant: () => LocalParticipant | null,
  livekitRoom: () => LiveKitRoom | null,
  options?: {
    maxLog?: number;
  },
) {
  const maxLog = options?.maxLog ?? 30;

  const rolls = ref<TableCircleDiceRollEntry[]>([]);
  const stateSynced = ref(false);

  const canRoll = computed(() => !!localParticipant() && !!livekitRoom());

  const pushRollLocal = (entry: TableCircleDiceRollEntry) => {
    rolls.value = mergeRollsById([entry], rolls.value).slice(0, maxLog);
  };

  const publishRoll = (entry: TableCircleDiceRollEntry) => {
    const local = localParticipant();
    const room = livekitRoom();
    if (!local || !room) return;

    const payload = JSON.stringify({
      type: "table_circle_dice_roll",
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

    const state: TableCircleDiceState = { rolls: rolls.value };
    const payload = JSON.stringify({
      type: "table_circle_dice_state",
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

        if (data.type === "table_circle_dice_roll" && data.payload) {
          const entry = data.payload as TableCircleDiceRollEntry;
          if (!entry.id || !entry.rollerIdentity) return;
          nextTick(() => {
            rolls.value = mergeRollsById(rolls.value, [entry]).slice(0, maxLog);
          });
          return;
        }

        if (data.type === "table_circle_dice_state" && data.payload) {
          const state = data.payload as TableCircleDiceState;
          if (!Array.isArray(state?.rolls)) return;
          nextTick(() => {
            rolls.value = mergeRollsById(rolls.value, state.rolls).slice(0, maxLog);
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

  const roll = (expression: string, d20Mode: DiceRollMode = "normal") => {
    const local = localParticipant();
    if (!local) return;
    const parsed = rollDiceExpression(expression, { d20Mode });
    if (!parsed) return;

    const entry: TableCircleDiceRollEntry = {
      ...parsed,
      id: createRollId(),
      ts: Date.now(),
      rollerIdentity: local.identity,
      d20Mode,
    };

    pushRollLocal(entry);
    publishRoll(entry);
  };

  const clear = () => {
    const local = localParticipant();
    const room = livekitRoom();
    if (!local || !room) return;
    rolls.value = [];
    // For now we don't broadcast clear; MVP keeps it as session-local.
  };

  return {
    rolls: computed(() => rolls.value),
    stateSynced,
    canRoll,
    roll,
    clear,
    rawRolls: rolls,
  };
}

