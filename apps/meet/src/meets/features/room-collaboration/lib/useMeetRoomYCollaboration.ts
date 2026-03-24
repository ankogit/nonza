import {
  shallowRef,
  ref,
  watch,
  onBeforeUnmount,
  type Ref,
  type ComputedRef,
} from "vue";
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import { encodeAwarenessUpdate } from "y-protocols/awareness";
import { YjsWebSocketProvider } from "@shared/lib";
import type { Room as RoomEntity } from "@shared/entities";
import type { MeetRoomCollaborationBundle } from "../model/types";

function wsUrlFromApiBase(apiBaseURL: string): string {
  const wsProtocol = apiBaseURL.startsWith("https://") ? "wss://" : "ws://";
  const wsHost = apiBaseURL.replace(/^https?:\/\//, "");
  return `${wsProtocol}${wsHost}`;
}

export function useMeetRoomYCollaboration(options: {
  room: Ref<RoomEntity | null>;
  apiBaseURL: Ref<string>;
  userId: Ref<string>;
  userName: Ref<string>;
  userColor: Ref<string>;
  enabled: ComputedRef<boolean>;
}): MeetRoomCollaborationBundle {
  const ydoc = shallowRef<Y.Doc | null>(null);
  const awareness = shallowRef<awarenessProtocol.Awareness | null>(null);
  const provider = shallowRef<YjsWebSocketProvider | null>(null);
  const connectionStatus = ref<
    "connecting" | "connected" | "disconnected"
  >("disconnected");

  function handleBeforeUnload() {
    persistRoomDocument();
    const aw = awareness.value;
    const prov = provider.value;
    if (!aw || !prov?.connected) return;
    try {
      aw.setLocalState(null);
      const p = prov as unknown as {
        ws?: WebSocket;
        roomId?: string;
      };
      if (p.ws?.readyState === WebSocket.OPEN && p.roomId) {
        const update = encodeAwarenessUpdate(aw, [aw.clientID]);
        if (update.length > 0) {
          const base64 = btoa(
            String.fromCharCode.apply(null, Array.from(update)),
          );
          p.ws.send(
            JSON.stringify({
              type: "yjs_awareness",
              room_id: p.roomId,
              payload: { update: base64 },
            }),
          );
        }
      }
    } catch {
      /* ignore */
    }
  }

  function persistRoomDocument() {
    try {
      if (provider.value?.connected) {
        provider.value.persistRoomDocument();
      }
    } catch {
      /* ignore */
    }
  }

  function teardown() {
    window.removeEventListener("beforeunload", handleBeforeUnload);
    window.removeEventListener("pagehide", handleBeforeUnload);

    persistRoomDocument();

    if (provider.value) {
      provider.value.destroy();
      provider.value = null;
    }
    if (awareness.value && typeof awareness.value.destroy === "function") {
      awareness.value.destroy();
    }
    awareness.value = null;
    if (ydoc.value) {
      ydoc.value.destroy();
      ydoc.value = null;
    }
    connectionStatus.value = "disconnected";
  }

  function setup() {
    teardown();
    const room = options.room.value;
    const base = options.apiBaseURL.value;
    if (!options.enabled.value || !room || !base) {
      return;
    }

    const doc = new Y.Doc();
    const aw = new awarenessProtocol.Awareness(doc);
    aw.setLocalStateField("user", {
      name: options.userName.value,
      color: options.userColor.value,
    });

    const prov = new YjsWebSocketProvider({
      url: wsUrlFromApiBase(base),
      roomId: room.id,
      userId: options.userId.value,
      doc,
      awareness: aw,
    });

    prov.onStatus((status) => {
      connectionStatus.value = status;
    });

    ydoc.value = doc;
    awareness.value = aw;
    provider.value = prov;

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);
  }

  watch(
    () =>
      [
        options.enabled.value,
        options.room.value?.id,
        options.apiBaseURL.value,
        options.userId.value,
      ] as const,
    () => {
      if (options.enabled.value) {
        setup();
      } else {
        teardown();
      }
    },
    { immediate: true },
  );

  watch(
    () => [options.userName.value, options.userColor.value] as const,
    ([name, color]) => {
      const aw = awareness.value;
      if (!aw) return;
      aw.setLocalStateField("user", { name, color });
    },
  );

  onBeforeUnmount(() => {
    teardown();
  });

  return { ydoc, awareness, provider, connectionStatus, persistRoomDocument };
}
