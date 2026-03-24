import type { Ref, ShallowRef } from "vue";
import type * as Y from "yjs";
import type * as awarenessProtocol from "y-protocols/awareness";
import type { YjsWebSocketProvider } from "@shared/lib";

export type MeetRoomConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected";

export type MeetRoomCollaborationBundle = {
  ydoc: ShallowRef<Y.Doc | null>;
  awareness: ShallowRef<awarenessProtocol.Awareness | null>;
  provider: ShallowRef<YjsWebSocketProvider | null>;
  connectionStatus: Ref<MeetRoomConnectionStatus>;
  persistRoomDocument: () => void;
};
