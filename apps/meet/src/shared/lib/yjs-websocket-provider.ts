import * as Y from "yjs";
import {
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness";

const B64_ENCODE_CHUNK = 8192;

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += B64_ENCODE_CHUNK) {
    const end = Math.min(i + B64_ENCODE_CHUNK, bytes.length);
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, end)));
  }
  return btoa(binary);
}

const B64_ASYNC_YIELD_EVERY = 6;

function yieldMacrotask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function uint8ArrayToBase64Async(bytes: Uint8Array): Promise<string> {
  let binary = "";
  let steps = 0;
  for (let i = 0; i < bytes.length; i += B64_ENCODE_CHUNK) {
    const end = Math.min(i + B64_ENCODE_CHUNK, bytes.length);
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, end)));
    steps += 1;
    if (steps % B64_ASYNC_YIELD_EVERY === 0 && end < bytes.length) {
      await yieldMacrotask();
    }
  }
  if (bytes.length > B64_ENCODE_CHUNK * 2) {
    await yieldMacrotask();
  }
  return btoa(binary);
}

export interface YjsWebSocketProviderOptions {
  url: string;
  roomId: string;
  userId: string;
  doc: Y.Doc;
  awareness?: any; // Y.js awareness object
}

export type YjsPersistStatus = "idle" | "saving" | "saved" | "error";

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
  private readonly UPDATE_DEBOUNCE_MS = 600;
  private readonly AWARENESS_DEBOUNCE_MS = 100; // Smaller debounce for awareness (cursors should be more responsive)
  private persistBackgroundGeneration = 0;
  private persistStatusHandler: ((status: YjsPersistStatus) => void) | null =
    null;
  private persistStatus: YjsPersistStatus = "idle";
  private persistQueuedOnReconnect = false;

  /**
   * After reconnect, block yjs_full_state until server snapshot is likely merged (or room empty).
   * Otherwise Redis can be overwritten with a doc that never received the persisted snapshot
   * if a live peer update arrives before the Redis payload on the wire.
   */
  private documentRemoteHydrated = false;
  private pendingFullStateAfterHydrate = false;
  private deferredPersistFlush = false;
  private serverHadPersistedDoc: boolean | null = null;
  private remoteDocApplyCountSinceOpen = 0;
  private hydrationFallbackTimer: number | null = null;
  private hydrateDebounceTimer: number | null = null;
  private readonly HYDRATION_FALLBACK_MS = 15000;
  private readonly HYDRATE_AFTER_REMOTE_APPLY_DEBOUNCE_MS = 180;

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

      this.pendingUpdates.push(update);

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        if (this.updateDebounceTimeout !== null) {
          window.clearTimeout(this.updateDebounceTimeout);
        }

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

  private clearHydrationFallbackTimer(): void {
    if (this.hydrationFallbackTimer !== null) {
      window.clearTimeout(this.hydrationFallbackTimer);
      this.hydrationFallbackTimer = null;
    }
  }

  private scheduleHydrationFallback(): void {
    this.clearHydrationFallbackTimer();
    this.hydrationFallbackTimer = window.setTimeout(() => {
      this.hydrationFallbackTimer = null;
      if (!this.documentRemoteHydrated) {
        console.warn(
          "[YjsWebSocketProvider] Document hydration timeout; allowing outbound full state.",
        );
        this.markDocumentRemoteHydrated();
      }
    }, this.HYDRATION_FALLBACK_MS);
  }

  private resetHydrationState(): void {
    this.documentRemoteHydrated = false;
    this.pendingFullStateAfterHydrate = false;
    this.deferredPersistFlush = false;
    this.serverHadPersistedDoc = null;
    this.remoteDocApplyCountSinceOpen = 0;
    this.clearHydrationFallbackTimer();
    if (this.hydrateDebounceTimer !== null) {
      window.clearTimeout(this.hydrateDebounceTimer);
      this.hydrateDebounceTimer = null;
    }
  }

  private flushDeferredAfterHydration(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    const needSend =
      this.pendingFullStateAfterHydrate || this.deferredPersistFlush;
    if (!needSend) {
      return;
    }
    const persistAfter = this.deferredPersistFlush;
    this.pendingFullStateAfterHydrate = false;
    this.deferredPersistFlush = false;
    try {
      this.sendFullStateNow();
      if (persistAfter) {
        this.emitPersistStatus("saved");
      }
    } catch {
      if (persistAfter) {
        this.emitPersistStatus("error");
      }
    }
  }

  private markDocumentRemoteHydrated(): void {
    if (this.documentRemoteHydrated) {
      this.flushDeferredAfterHydration();
      return;
    }
    this.documentRemoteHydrated = true;
    this.clearHydrationFallbackTimer();
    if (this.hydrateDebounceTimer !== null) {
      window.clearTimeout(this.hydrateDebounceTimer);
      this.hydrateDebounceTimer = null;
    }
    this.flushDeferredAfterHydration();
  }

  private scheduleHydrationAfterRemoteApplies(): void {
    if (this.documentRemoteHydrated) return;
    if (this.hydrateDebounceTimer !== null) {
      window.clearTimeout(this.hydrateDebounceTimer);
    }
    this.hydrateDebounceTimer = window.setTimeout(() => {
      this.hydrateDebounceTimer = null;
      this.markDocumentRemoteHydrated();
    }, this.HYDRATE_AFTER_REMOTE_APPLY_DEBOUNCE_MS);
  }

  private noteRemoteDocUpdateMerged(): void {
    this.remoteDocApplyCountSinceOpen += 1;
    if (this.serverHadPersistedDoc === true) {
      this.scheduleHydrationAfterRemoteApplies();
    }
  }

  private sendFullStateWhenHydrated(fromPersist: boolean): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (fromPersist) {
        this.persistQueuedOnReconnect = true;
      }
      return;
    }
    if (!this.documentRemoteHydrated) {
      if (fromPersist) {
        this.deferredPersistFlush = true;
      } else {
        this.pendingFullStateAfterHydrate = true;
      }
      return;
    }
    try {
      this.sendFullStateNow();
      if (fromPersist) {
        this.emitPersistStatus("saved");
      }
    } catch {
      if (fromPersist) {
        this.emitPersistStatus("error");
      }
    }
  }

  private async waitUntilDocumentRemoteHydrated(
    expectedGen: number,
    maxMs: number,
  ): Promise<void> {
    const t0 = Date.now();
    while (!this.documentRemoteHydrated) {
      if (expectedGen !== this.persistBackgroundGeneration) {
        return;
      }
      if (Date.now() - t0 > maxMs) {
        console.warn(
          "[YjsWebSocketProvider] Persist: document hydration wait exceeded; flushing full state.",
        );
        this.markDocumentRemoteHydrated();
        return;
      }
      await yieldMacrotask();
    }
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

        this.resetHydrationState();
        this.scheduleHydrationFallback();

        // Send initial sync message
        this.sendSync();
        window.setTimeout(() => {
          this.flushPendingUpdates();
        }, 0);
        if (this.persistQueuedOnReconnect) {
          this.persistQueuedOnReconnect = false;
          window.setTimeout(() => {
            this.persistRoomDocumentInBackground();
          }, 250);
        }
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

      try {
        Y.applyUpdate(this.doc, update, this);
        this.noteRemoteDocUpdateMerged();
        if (!this.synced) {
          this.synced = true;
          this.emitSynced();
        }
      } catch (docErr) {
        if (this.awareness && update.length > 0) {
          try {
            applyAwarenessUpdate(this.awareness, update, this);
          } catch (awarenessErr) {
            console.error(
              "[YjsWebSocketProvider] Error applying document update:",
              docErr,
            );
            console.error(
              "[YjsWebSocketProvider] Error applying awareness update:",
              awarenessErr,
            );
            console.error("[YjsWebSocketProvider] Update details:", {
              length: update.length,
              firstBytes:
                update.length > 0
                  ? Array.from(update.slice(0, Math.min(10, update.length)))
                  : [],
            });
          }
        } else {
          console.error(
            "[YjsWebSocketProvider] Error applying document update:",
            docErr,
          );
          console.error("[YjsWebSocketProvider] Update details:", {
            length: update.length,
            firstBytes:
              update.length > 0
                ? Array.from(update.slice(0, Math.min(10, update.length)))
                : [],
            errorMessage:
              docErr instanceof Error ? docErr.message : String(docErr),
          });
        }
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
      const rawPayload = message.payload as Record<string, unknown> | undefined;
      const updateField =
        typeof message.update === "string"
          ? message.update
          : rawPayload && typeof rawPayload.update === "string"
            ? rawPayload.update
            : undefined;
      if (updateField) {
        try {
          const binaryString = atob(updateField);
          const update = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            update[i] = binaryString.charCodeAt(i);
          }

          // Apply update to document (with origin to prevent echo)
          Y.applyUpdate(this.doc, update, this);
          this.noteRemoteDocUpdateMerged();
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
      const payload = message.payload as { synced?: boolean } | undefined;
      if (payload?.synced === false) {
        this.serverHadPersistedDoc = false;
        this.markDocumentRemoteHydrated();
        window.setTimeout(() => this.sendFullStateWhenHydrated(false), 500);
      } else if (payload?.synced === true) {
        this.serverHadPersistedDoc = true;
        if (this.remoteDocApplyCountSinceOpen > 0) {
          this.scheduleHydrationAfterRemoteApplies();
        }
      } else {
        this.serverHadPersistedDoc = true;
        if (this.remoteDocApplyCountSinceOpen > 0) {
          this.scheduleHydrationAfterRemoteApplies();
        }
      }
    } else if (message.type === "user_joined") {
      this.sendFullStateWhenHydrated(false);
    }
  }

  // Flush pending document updates (merge and send)
  private flushPendingUpdates(): void {
    if (this.pendingUpdates.length === 0) {
      return;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.updateDebounceTimeout = null;
      return;
    }

    const updatesToMerge = [...this.pendingUpdates];
    this.pendingUpdates = [];
    this.updateDebounceTimeout = null;

    let mergedUpdate: Uint8Array;
    try {
      mergedUpdate = Y.mergeUpdates(updatesToMerge);
    } catch (error) {
      console.error("[YjsWebSocketProvider] Error merging updates:", error);
      this.pendingUpdates = [...updatesToMerge, ...this.pendingUpdates];
      return;
    }

    try {
      const base64 = uint8ArrayToBase64(mergedUpdate);
      const message = {
        type: "yjs_update",
        room_id: this.roomId,
        payload: {
          update: base64,
        },
      };
      const jsonMessage = JSON.stringify(message);
      this.ws.send(jsonMessage);

      if (mergedUpdate.length < 50) {
        setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.sendFullStateWhenHydrated(false);
          }
        }, 200);
      }
    } catch (error) {
      console.error("[YjsWebSocketProvider] Error flushing updates:", error);
      this.pendingUpdates = [mergedUpdate, ...this.pendingUpdates];
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

      const base64 = uint8ArrayToBase64(update);
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
      const base64 = uint8ArrayToBase64(update);
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

  persistRoomDocument(): void {
    if (this.updateDebounceTimeout !== null) {
      window.clearTimeout(this.updateDebounceTimeout);
      this.updateDebounceTimeout = null;
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.persistQueuedOnReconnect = true;
      return;
    }
    this.emitPersistStatus("saving");
    try {
      this.flushPendingUpdates();
      this.sendFullStateWhenHydrated(true);
    } catch {
      this.deferredPersistFlush = false;
      this.emitPersistStatus("error");
    }
  }

  persistRoomDocumentInBackground(): void {
    const gen = ++this.persistBackgroundGeneration;
    void (async () => {
      try {
        if (this.updateDebounceTimeout !== null) {
          window.clearTimeout(this.updateDebounceTimeout);
          this.updateDebounceTimeout = null;
        }
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          this.persistQueuedOnReconnect = true;
          return;
        }
        this.emitPersistStatus("saving");
        await yieldMacrotask();
        if (gen !== this.persistBackgroundGeneration) return;
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        this.flushPendingUpdates();
        await yieldMacrotask();
        if (gen !== this.persistBackgroundGeneration) return;
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        await this.waitUntilDocumentRemoteHydrated(
          gen,
          this.HYDRATION_FALLBACK_MS,
        );
        if (gen !== this.persistBackgroundGeneration) return;
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        await this.sendFullStateAsync(gen);
        if (gen === this.persistBackgroundGeneration) {
          this.emitPersistStatus("saved");
        }
      } catch {
        if (gen === this.persistBackgroundGeneration) {
          this.emitPersistStatus("error");
        }
      }
    })();
  }

  /** Sends full document state (Y.encodeStateAsUpdate) so server can store it for new joiners. */
  private sendFullStateNow(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    const stateUpdate = Y.encodeStateAsUpdate(this.doc);
    const base64 = uint8ArrayToBase64(stateUpdate);
    const message = {
      type: "yjs_full_state",
      room_id: this.roomId,
      payload: { update: base64 },
    };
    this.ws.send(JSON.stringify(message));
  }

  private async sendFullStateAsync(
    expectedGen: number,
  ): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    if (expectedGen !== this.persistBackgroundGeneration) return;
    try {
      const stateUpdate = Y.encodeStateAsUpdate(this.doc);
      await yieldMacrotask();
      if (expectedGen !== this.persistBackgroundGeneration) return;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const base64 = await uint8ArrayToBase64Async(stateUpdate);
      await yieldMacrotask();
      if (expectedGen !== this.persistBackgroundGeneration) return;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
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

  onPersistStatus(handler: (status: YjsPersistStatus) => void): void {
    this.persistStatusHandler = handler;
    handler(this.persistStatus);
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

  private emitPersistStatus(status: YjsPersistStatus): void {
    this.persistStatus = status;
    if (this.persistStatusHandler) {
      this.persistStatusHandler(status);
    }
  }

  disconnect(): void {
    this.persistBackgroundGeneration += 1;
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
