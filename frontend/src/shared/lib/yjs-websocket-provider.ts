import * as Y from "yjs";
import {
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness";

export interface YjsWebSocketProviderOptions {
  url: string;
  roomId: string;
  userId: string;
  doc: Y.Doc;
  awareness?: any; // Y.js awareness object
}

/**
 * Custom Y.js WebSocket provider that works with the existing Go WebSocket server.
 * Sends Y.js updates as binary messages wrapped in JSON for compatibility.
 */
export class YjsWebSocketProvider {
  private ws: WebSocket | null = null;
  private url: string;
  private roomId: string;
  private userId: string;
  private doc: Y.Doc;
  public awareness: any; // Public so CollaborationCaret can access it
  private synced = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private reconnectTimeout: number | null = null;
  private updateHandler: ((update: Uint8Array, origin: any) => void) | null =
    null;
  private statusHandler:
    | ((status: "connecting" | "connected" | "disconnected") => void)
    | null = null;
  private syncedHandler: (() => void) | null = null;

  // Debouncing for updates to reduce server load
  private updateDebounceTimeout: number | null = null;
  private pendingUpdates: Uint8Array[] = [];
  private awarenessDebounceTimeout: number | null = null;
  private pendingAwarenessUpdate: Uint8Array | null = null;
  private readonly UPDATE_DEBOUNCE_MS = 250; // Debounce delay for document updates
  private readonly AWARENESS_DEBOUNCE_MS = 100; // Smaller debounce for awareness (cursors should be more responsive)

  constructor(options: YjsWebSocketProviderOptions) {
    this.url = options.url;
    this.roomId = options.roomId;
    this.userId = options.userId;
    this.doc = options.doc;
    this.awareness = options.awareness;

    // Listen to document updates
    this.updateHandler = (update: Uint8Array, origin: any) => {
      // Don't send updates that came from this provider (to prevent echo)
      if (origin === this) {
        return;
      }

      // Don't send updates that came from the Collaboration extension (it handles its own sync)
      // Only send updates from Y.js document changes
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Add update to pending queue
        this.pendingUpdates.push(update);

        // Clear existing debounce timeout
        if (this.updateDebounceTimeout !== null) {
          window.clearTimeout(this.updateDebounceTimeout);
        }

        // Set new debounce timeout
        this.updateDebounceTimeout = window.setTimeout(() => {
          this.flushPendingUpdates();
        }, this.UPDATE_DEBOUNCE_MS);
      }
    };

    this.doc.on("update", this.updateHandler);

    // Listen to awareness updates if provided
    if (this.awareness) {
      // Listen to awareness changes and send updates
      // The "change" event provides added/updated/removed arrays
      this.awareness.on(
        "change",
        (
          changes: { added: number[]; updated: number[]; removed: number[] },
          origin: any,
        ) => {
          // Only send updates that are NOT from applying remote updates (to prevent echo)
          // When we apply a remote awareness update via applyAwarenessUpdate, origin will be this provider
          // When awareness updates locally (cursor movement), origin will be something else (usually null or the awareness object itself)
          // So we skip only if origin is explicitly this provider (meaning we just applied a remote update)
          if (origin === this) {
            return;
          }

          // Check if this is a disconnection (local state is null)
          const localState = this.awareness.getLocalState();
          if (localState === null) {
            // This is a disconnection - send update to notify others
            // When setLocalState(null) is called, it marks the client as offline
            const update = encodeAwarenessUpdate(this.awareness, [
              this.awareness.clientID,
            ]);
            if (
              update.length > 0 &&
              this.ws &&
              this.ws.readyState === WebSocket.OPEN
            ) {
              this.sendAwarenessUpdate(update);
              return;
            }
          }

          // Encode awareness update for the changed clients
          const changedClients = [
            ...changes.added,
            ...changes.updated,
            ...changes.removed,
          ];
          if (changedClients.length === 0) {
            return;
          }

          // Encode the awareness update as Uint8Array
          const update = encodeAwarenessUpdate(this.awareness, changedClients);

          if (update.length === 0) {
            return;
          }

          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Debounce awareness updates (but less than document updates for responsiveness)
            this.pendingAwarenessUpdate = update;

            // Clear existing debounce timeout
            if (this.awarenessDebounceTimeout !== null) {
              window.clearTimeout(this.awarenessDebounceTimeout);
            }

            // Set new debounce timeout
            this.awarenessDebounceTimeout = window.setTimeout(() => {
              this.flushPendingAwarenessUpdate();
            }, this.AWARENESS_DEBOUNCE_MS);
          }
        },
      );
    } else {
      console.warn("[YjsWebSocketProvider] No awareness provided!");
    }

    // Connect automatically
    this.connect();
  }

  private connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.emitStatus("connecting");

    try {
      const wsUrl = `${this.url}/ws?room_id=${encodeURIComponent(this.roomId)}&user_id=${encodeURIComponent(this.userId)}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.binaryType = "arraybuffer";

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.emitStatus("connected");

        // Send initial sync message
        this.sendSync();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        this.handleMessage(event);
      };

      this.ws.onerror = (error) => {
        console.error("[YjsWebSocketProvider] WebSocket error:", error);
        console.error("[YjsWebSocketProvider] WebSocket URL was:", wsUrl);
        console.error(
          "[YjsWebSocketProvider] Connection state:",
          this.ws?.readyState,
        );
      };

      this.ws.onclose = (event) => {
        // Clear awareness state when disconnecting to remove stale selections/cursors
        if (
          this.awareness &&
          this.ws &&
          this.ws.readyState === WebSocket.OPEN
        ) {
          try {
            // Set local state to null/empty to signal that this client is disconnecting
            // This will trigger a change event that removes this client's state from others
            this.awareness.setLocalStateField("user", null);
            // Send final awareness update to notify others of disconnection
            const update = encodeAwarenessUpdate(this.awareness, [
              this.awareness.clientID,
            ]);
            if (update.length > 0) {
              this.sendAwarenessUpdate(update);
            }
          } catch (error) {
            console.error(
              "[YjsWebSocketProvider] Error clearing awareness on disconnect:",
              error,
            );
          }
        }

        this.ws = null;
        this.synced = false;
        this.emitStatus("disconnected");

        // Attempt to reconnect only if it wasn't a clean close or if it was a server error
        if (!event.wasClean || event.code === 1006) {
          this.attemptReconnect();
        }
      };
    } catch (error) {
      console.error("[YjsWebSocketProvider] Connection error:", error);
      this.emitStatus("disconnected");
      this.attemptReconnect();
    }
  }

  private handleMessage(event: MessageEvent): void {
    // Handle binary messages (Y.js document updates or awareness updates)
    if (event.data instanceof ArrayBuffer) {
      const update = new Uint8Array(event.data);

      // Try to apply as document update first (most common case)
      // If it fails and update is small, try as awareness update
      const isSmallUpdate = update.length < 500;

      if (isSmallUpdate && this.awareness && update.length > 0) {
        // Try as awareness update first for small non-empty updates
        // Empty updates are always document updates (document cleared)
        try {
          // Try to apply as awareness update
          // Get states before update for comparison
          applyAwarenessUpdate(this.awareness, update, this);
          return;
        } catch {
          // If awareness update fails, try as document update
        }
      }

      // Apply as document update (either because it's large, awareness failed, or it's empty)
      // Empty updates are valid - they represent document clearing
      try {
        Y.applyUpdate(this.doc, update, this);
        if (!this.synced) {
          this.synced = true;
          this.emitSynced();
        }
      } catch (error) {
        console.error(
          "[YjsWebSocketProvider] Error applying document update:",
          error,
        );
        console.error("[YjsWebSocketProvider] Update details:", {
          length: update.length,
          firstBytes:
            update.length > 0
              ? Array.from(update.slice(0, Math.min(10, update.length)))
              : [],
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    // Handle text messages (JSON). Server may send multiple JSON objects in one frame, separated by newlines.
    const text = (event.data as string).trim();
    if (!text) {
      console.warn("[YjsWebSocketProvider] Received empty text message");
      return;
    }

    const lines = text ? text.split("\n") : [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const message = JSON.parse(trimmed);
        this.processJsonMessage(message);
      } catch (error) {
        console.error(
          "[YjsWebSocketProvider] Error parsing JSON message:",
          error,
        );
        console.error(
          "[YjsWebSocketProvider] Message content:",
          trimmed.substring(0, 100),
        );
      }
    }
  }

  private processJsonMessage(message: Record<string, unknown>): void {
    if (message.type === "yjs_update") {
      // Decode base64 update
      if (message.update && typeof message.update === "string") {
        try {
          const binaryString = atob(message.update);
          const update = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            update[i] = binaryString.charCodeAt(i);
          }

          // Apply update to document (with origin to prevent echo)
          Y.applyUpdate(this.doc, update, this);
          if (!this.synced) {
            this.synced = true;
            this.emitSynced();
          }
        } catch (error) {
          console.error(
            "[YjsWebSocketProvider] Error decoding/applying update:",
            error,
          );
        }
      }
    } else if (message.type === "yjs_awareness") {
      // Awareness updates are now sent as binary messages, not JSON
      // This case should not occur, but log if it does
      console.warn(
        "[YjsWebSocketProvider] Received yjs_awareness as JSON (should be binary)",
      );
    } else if (message.type === "connected") {
      this.sendSync();
    } else if (message.type === "yjs_sync_ack") {
      // If server had no state (first participant), push our full state so server has it for new joiners
      const payload = message.payload as { synced?: boolean } | undefined;
      if (payload?.synced === false) {
        window.setTimeout(() => this.sendFullState(), 500);
      }
    } else if (message.type === "user_joined") {
      this.sendFullState();
    }
  }

  // Flush pending document updates (merge and send)
  private flushPendingUpdates(): void {
    if (this.pendingUpdates.length === 0) {
      return;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn(
        "[YjsWebSocketProvider] Cannot flush updates: WebSocket not open",
      );
      this.pendingUpdates = [];
      this.updateDebounceTimeout = null;
      return;
    }

    try {
      // Merge multiple updates into one using Y.js mergeUpdates
      // This reduces the number of messages sent to the server
      const updatesToMerge = [...this.pendingUpdates];
      const mergedUpdate = Y.mergeUpdates(updatesToMerge);
      this.pendingUpdates = [];
      this.updateDebounceTimeout = null;

      // Send merged update
      const base64 = btoa(
        String.fromCharCode.apply(null, Array.from(mergedUpdate)),
      );
      const message = {
        type: "yjs_update",
        room_id: this.roomId,
        payload: {
          update: base64,
        },
      };
      const jsonMessage = JSON.stringify(message);
      this.ws.send(jsonMessage);

      // If update is very small (likely document was cleared), also send full state
      // This ensures empty document state is properly synchronized
      if (mergedUpdate.length < 50) {
        setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.sendFullState();
          }
        }, 200);
      }
    } catch (error) {
      console.error("[YjsWebSocketProvider] Error flushing updates:", error);
      this.pendingUpdates = [];
      this.updateDebounceTimeout = null;
    }
  }

  // Flush pending awareness update
  private flushPendingAwarenessUpdate(): void {
    if (!this.pendingAwarenessUpdate) {
      return;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.awareness) {
      this.pendingAwarenessUpdate = null;
      this.awarenessDebounceTimeout = null;
      return;
    }

    try {
      const update = this.pendingAwarenessUpdate;
      this.pendingAwarenessUpdate = null;
      this.awarenessDebounceTimeout = null;

      const base64 = btoa(String.fromCharCode.apply(null, Array.from(update)));
      const message = {
        type: "yjs_awareness",
        room_id: this.roomId,
        payload: { update: base64 },
      };
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(
        "[YjsWebSocketProvider] Error sending awareness update:",
        error,
      );
    }
  }

  private sendAwarenessUpdate(update: Uint8Array): void {
    // This method is now only used for immediate sends (like disconnection)
    // Regular awareness updates go through debouncing
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.awareness) {
      return;
    }

    try {
      const base64 = btoa(String.fromCharCode.apply(null, Array.from(update)));
      const message = {
        type: "yjs_awareness",
        room_id: this.roomId,
        payload: {
          update: base64,
        },
      };
      const jsonMessage = JSON.stringify(message);
      this.ws.send(jsonMessage);
    } catch (error) {
      console.error(
        "[YjsWebSocketProvider] Error sending awareness update:",
        error,
      );
    }
  }

  private sendSync(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Request document state from server
    // Server will send stored document state if available
    const message = {
      type: "yjs_sync",
      room_id: this.roomId,
    };

    this.ws.send(JSON.stringify(message));
  }

  /** Sends full document state (Y.encodeStateAsUpdate) so server can store it for new joiners. */
  private sendFullState(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      const stateUpdate = Y.encodeStateAsUpdate(this.doc);
      const base64 = btoa(
        String.fromCharCode.apply(null, Array.from(stateUpdate)),
      );
      const message = {
        type: "yjs_full_state",
        room_id: this.roomId,
        payload: { update: base64 },
      };
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error("[YjsWebSocketProvider] Error sending full state:", error);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[YjsWebSocketProvider] Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  private emitStatus(
    status: "connecting" | "connected" | "disconnected",
  ): void {
    if (this.statusHandler) {
      this.statusHandler(status);
    }
  }

  onStatus(
    handler: (status: "connecting" | "connected" | "disconnected") => void,
  ): void {
    this.statusHandler = handler;
  }

  on(
    event: "status" | "synced" | "awarenessUpdate" | "awarenessChange",
    handler: any,
  ): void {
    if (event === "status") {
      this.statusHandler = handler;
    } else if (event === "synced") {
      this.syncedHandler = handler;
    } else if (event === "awarenessUpdate" || event === "awarenessChange") {
      // Awareness events are handled by the awareness object itself
      if (this.awareness) {
        this.awareness.on("update", handler);
      }
    }
  }

  off(
    event: "status" | "synced" | "awarenessUpdate" | "awarenessChange",
    handler: any,
  ): void {
    if (event === "status") {
      this.statusHandler = null;
    } else if (event === "synced") {
      this.syncedHandler = null;
    } else if (event === "awarenessUpdate" || event === "awarenessChange") {
      if (this.awareness) {
        this.awareness.off("update", handler);
      }
    }
  }

  private emitSynced(): void {
    if (this.syncedHandler && this.synced) {
      this.syncedHandler();
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Flush any pending updates before disconnecting
    if (this.updateDebounceTimeout !== null) {
      clearTimeout(this.updateDebounceTimeout);
      this.updateDebounceTimeout = null;
      this.flushPendingUpdates();
    }

    if (this.awarenessDebounceTimeout !== null) {
      clearTimeout(this.awarenessDebounceTimeout);
      this.awarenessDebounceTimeout = null;
      this.flushPendingAwarenessUpdate();
    }

    if (this.updateHandler) {
      this.doc.off("update", this.updateHandler);
      this.updateHandler = null;
    }

    // Send final awareness update BEFORE closing WebSocket
    // setLocalState(null) marks the client as offline
    if (this.awareness && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.awareness.setLocalState(null);
        // Send update synchronously - change handler will send it automatically
        // But we also send it directly here to ensure it's sent before close
        const update = encodeAwarenessUpdate(this.awareness, [
          this.awareness.clientID,
        ]);
        if (update.length > 0) {
          this.sendAwarenessUpdate(update);
        }
      } catch (error) {
        console.error(
          "[YjsWebSocketProvider] Error clearing awareness on disconnect:",
          error,
        );
      }
    }

    if (this.ws) {
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close();
      }
      this.ws = null;
    }

    // Clean up awareness after WebSocket is closed
    if (this.awareness && typeof this.awareness.destroy === "function") {
      this.awareness.destroy();
    }

    this.synced = false;
  }

  get isSynced(): boolean {
    return this.synced;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // Methods for CollaborationCaret compatibility
  // CollaborationCaret expects provider.awareness to be accessible
  // Note: awareness is already a private property, so we expose it via getter
  // But we need to make sure CollaborationCaret can access it
  setAwarenessField(field: string, value: any): void {
    if (this.awareness) {
      this.awareness.setLocalStateField(field, value);
    }
  }

  destroy(): void {
    this.disconnect();
  }
}
