import { ref, watch, computed, type Ref } from "vue";
import { RoomEvent, ConnectionState, ConnectionQuality } from "livekit-client";
import type { Room } from "livekit-client";

export type ConnectionIndicatorStatus = "good" | "warning" | "bad";

export function useConnectionIndicator(livekitRoom: Ref<Room | null>) {
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

  watch(
    livekitRoom,
    (room) => {
      connectionState.value = ConnectionState.Disconnected;
      connectionQuality.value = ConnectionQuality.Unknown;
      if (!room) return;

      connectionState.value = room.state;
      connectionQuality.value =
        room.localParticipant?.connectionQuality ?? ConnectionQuality.Unknown;

      const onState = (s: ConnectionState) => {
        connectionState.value = s;
      };
      const onQuality = (
        quality: ConnectionQuality,
        participant: { identity: string },
      ) => {
        if (participant?.identity === room.localParticipant?.identity) {
          connectionQuality.value = quality;
        }
      };
      room.on(RoomEvent.ConnectionStateChanged, onState);
      room.on(RoomEvent.ConnectionQualityChanged, onQuality);
      return () => {
        room.off(RoomEvent.ConnectionStateChanged, onState);
        room.off(RoomEvent.ConnectionQualityChanged, onQuality);
      };
    },
    { immediate: true },
  );

  return { connectionStatus, connectionLabel };
}
