const STORAGE_KEY_PREFIX = "nonza_media_state_";

export interface StoredMediaState {
  micEnabled?: boolean;
  videoEnabled?: boolean;
}

function storageKey(roomShortCode: string): string {
  return `${STORAGE_KEY_PREFIX}${roomShortCode}`;
}

export function getStoredMediaState(roomShortCode: string): StoredMediaState {
  try {
    const raw = localStorage.getItem(storageKey(roomShortCode));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        micEnabled:
          typeof (parsed as StoredMediaState).micEnabled === "boolean"
            ? (parsed as StoredMediaState).micEnabled
            : undefined,
        videoEnabled:
          typeof (parsed as StoredMediaState).videoEnabled === "boolean"
            ? (parsed as StoredMediaState).videoEnabled
            : undefined,
      };
    }
  } catch {
    /* ignore */
  }
  return {};
}

export function setStoredMediaState(
  roomShortCode: string,
  state: StoredMediaState,
): void {
  try {
    const key = storageKey(roomShortCode);
    const toStore = { ...getStoredMediaState(roomShortCode), ...state };
    if (
      toStore.micEnabled === undefined &&
      toStore.videoEnabled === undefined
    ) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(toStore));
    }
  } catch {
    /* ignore */
  }
}
