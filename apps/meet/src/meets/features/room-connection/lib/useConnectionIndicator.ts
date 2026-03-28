import { ref, watch, computed, toValue, type MaybeRef } from "vue";
import { RoomEvent, ConnectionState, ConnectionQuality } from "livekit-client";
import type { Room } from "livekit-client";
import type { PixelIconName } from "@shared/ui/PixelIcon/icons";

export type ConnectionIndicatorStatus = "good" | "warning" | "bad";

export function useConnectionIndicator(livekitRoom: MaybeRef<Room | null>) {
  const connectionState = ref<ConnectionState>(ConnectionState.Disconnected);
  const connectionQuality = ref<ConnectionQuality>(ConnectionQuality.Unknown);

  const connectionStatus = computed<ConnectionIndicatorStatus>(() => {
    const state = connectionState.value;
    const quality = connectionQuality.value;
    if (
      state === ConnectionState.Disconnected ||
      quality === ConnectionQuality.Lost
    )
      return "bad";
    if (
      state === ConnectionState.Connected &&
      (quality === ConnectionQuality.Excellent ||
        quality === ConnectionQuality.Unknown)
    )
      return "good";
    return "warning";
  });

  const connectionLabel = computed(() => {
    const status = connectionStatus.value;
    if (status === "good") return "Сеть в порядке";
    if (status === "warning") return "Нестабильное соединение";
    return "Нет соединения";
  });

  const connectionVariant = computed((): "success" | "warning" | "danger" => {
    const status = connectionStatus.value;
    if (status === "good") return "success";
    if (status === "warning") return "warning";
    return "danger";
  });

  const connectionIconName = computed((): PixelIconName => {
    const status = connectionStatus.value;
    if (status === "good") return "connection-good";
    if (status === "warning") return "connection-medium";
    return "connection-bad";
  });

  const connectionIndicatorVisible = computed(() => {
    const room = toValue(livekitRoom) ?? null;
    if (!room) return false;
    return connectionState.value !== ConnectionState.Connecting;
  });

  watch(
    () => toValue(livekitRoom) ?? null,
    (room) => {
      connectionState.value = ConnectionState.Disconnected;
      connectionQuality.value = ConnectionQuality.Unknown;
      if (!room) return;
      const r = room;

      function syncFromRoom() {
        connectionState.value = r.state;
        connectionQuality.value =
          r.localParticipant?.connectionQuality ?? ConnectionQuality.Unknown;
      }

      syncFromRoom();

      const onState = (s: ConnectionState) => {
        connectionState.value = s;
        if (s === ConnectionState.Connected) {
          queueMicrotask(() => syncFromRoom());
        }
      };
      const onQuality = (
        quality: ConnectionQuality,
        participant: { identity: string },
      ) => {
        const local = r.localParticipant;
        if (!local) return;
        if (participant.identity === local.identity) {
          connectionQuality.value = quality;
        }
      };
      r.on(RoomEvent.ConnectionStateChanged, onState);
      r.on(RoomEvent.ConnectionQualityChanged, onQuality);
      return () => {
        r.off(RoomEvent.ConnectionStateChanged, onState);
        r.off(RoomEvent.ConnectionQualityChanged, onQuality);
      };
    },
    { immediate: true },
  );

  return {
    connectionStatus,
    connectionLabel,
    connectionVariant,
    connectionIconName,
    connectionIndicatorVisible,
  };
}
