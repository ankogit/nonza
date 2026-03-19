import { ref, computed, watch, nextTick, onUnmounted } from "vue";
import { RoomEvent } from "livekit-client";
import type {
  LocalParticipant,
  RemoteParticipant,
  Room as LiveKitRoom,
} from "livekit-client";

const DATA_TOPIC = "table_circle";

export interface TableCircleState {
  hostIdentity: string | null;
  seatingOrder: string[];
}

export function useTableCircle(
  localParticipant: () => LocalParticipant | null,
  allParticipantIdentities: () => string[],
  livekitRoom: () => LiveKitRoom | null,
) {
  const state = ref<TableCircleState>({
    hostIdentity: null,
    seatingOrder: [],
  });

  const stateSynced = ref(false);

  const broadcastState = () => {
    const local = localParticipant();
    const room = livekitRoom();
    if (!local || !room) return;
    try {
      const data = JSON.stringify({
        type: "table_circle_state",
        payload: {
          hostIdentity: state.value.hostIdentity,
          seatingOrder: [...state.value.seatingOrder],
        },
      });
      local
        .publishData(new TextEncoder().encode(data), {
          reliable: true,
          topic: DATA_TOPIC,
        })
        .catch((err) => console.warn("[table-circle] broadcast", err));
    } catch (e) {
      console.warn("[table-circle] broadcast", e);
    }
  };

  const isHost = computed(() => {
    const local = localParticipant();
    return local ? state.value.hostIdentity === local.identity : false;
  });

  const orderedIdentities = computed(() => {
    const order = state.value.seatingOrder;
    const identities = allParticipantIdentities();
    if (order.length === 0) return identities;
    const set = new Set(identities);
    const result: string[] = [];
    for (const id of order) {
      if (set.has(id)) result.push(id);
    }
    for (const id of identities) {
      if (!result.includes(id)) result.push(id);
    }
    return result;
  });

  const initFromParticipants = () => {
    const identities = allParticipantIdentities();
    if (identities.length === 0) return;
    if (state.value.seatingOrder.length > 0) return;
    state.value.seatingOrder = [...identities];
    if (!state.value.hostIdentity) state.value.hostIdentity = identities[0];
    broadcastState();
  };

  const setSeatingOrder = (order: string[]) => {
    state.value.seatingOrder = [...order];
    broadcastState();
  };

  const moveInOrder = (identity: string, direction: "left" | "right") => {
    const order = [...state.value.seatingOrder];
    const idx = order.indexOf(identity);
    if (idx === -1) return;
    const n = order.length;
    if (n < 2) return;
    const nextIdx = direction === "left" ? (idx - 1 + n) % n : (idx + 1) % n;
    ;[order[idx], order[nextIdx]] = [order[nextIdx], order[idx]];
    state.value.seatingOrder = order;
    broadcastState();
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
      if (participant && participant.identity === local?.identity) return;

      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type === "request_state") {
          broadcastState();
          return;
        }
        if (data.type !== "table_circle_state" || !data.payload) return;

        nextTick(() => {
          const p = data.payload as Partial<TableCircleState>;
          if (p.hostIdentity !== undefined) state.value.hostIdentity = p.hostIdentity;
          if (Array.isArray(p.seatingOrder) && p.seatingOrder.length > 0) {
            state.value.seatingOrder = [...p.seatingOrder];
          }
          stateSynced.value = true;
        });
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
      setTimeout(requestState, 400);
      setTimeout(() => {
        initFromParticipants();
        stateSynced.value = true;
      }, 800);
    } else {
      room.once("connected", () => {
        setTimeout(requestState, 400);
        setTimeout(() => {
          initFromParticipants();
          stateSynced.value = true;
        }, 800);
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

  watch(allParticipantIdentities, (identities) => {
    if (identities.length === 0) return;
    const order = state.value.seatingOrder;
    const set = new Set(order);
    const missing = identities.filter((id) => !set.has(id));
    if (missing.length === 0) return;
    state.value.seatingOrder = [...order];
    for (const id of missing) state.value.seatingOrder.push(id);
    if (!state.value.hostIdentity && state.value.seatingOrder.length > 0) {
      state.value.hostIdentity = state.value.seatingOrder[0];
    }
    if (isHost.value) broadcastState();
  }, { deep: true });

  onUnmounted(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  });

  return {
    state,
    stateSynced,
    isHost,
    orderedIdentities,
    setSeatingOrder,
    moveInOrder,
    initFromParticipants,
    broadcastState,
  };
}
