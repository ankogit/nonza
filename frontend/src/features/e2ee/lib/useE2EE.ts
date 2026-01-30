import { ref, computed, type Ref } from "vue";
import { E2EE_SUPPORTED } from "@shared/lib";
import type { Room } from "livekit-client";

export interface E2EEState {
  isSupported: boolean;
  isEnabled: boolean;
  isActive: boolean;
  error: string | null;
}

/** @param room Ref or getter that returns the LiveKit room (reactive). */
export function useE2EE(room: Ref<Room | null> | (() => Room | null)) {
  const roomRef = typeof room === "function" ? computed(room) : room;
  const error = ref<string | null>(null);

  const state = computed<E2EEState>(() => {
    const r = roomRef.value;
    const hasSetup = r?.hasE2EESetup ?? false;
    const isActive = r?.isE2EEEnabled ?? false;
    return {
      isSupported: E2EE_SUPPORTED,
      isEnabled: hasSetup,
      isActive,
      error: error.value,
    };
  });

  const enable = async (): Promise<void> => {
    error.value = null;
    if (!E2EE_SUPPORTED) {
      error.value = "E2EE не поддерживается в этом браузере";
      throw new Error("E2EE не поддерживается");
    }
    const r = roomRef.value;
    if (!r) {
      error.value = "Комната не подключена";
      throw new Error("Комната не подключена");
    }
    try {
      await r.setE2EEEnabled(true);
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Не удалось включить E2EE";
      throw err;
    }
  };

  const disable = async (): Promise<void> => {
    error.value = null;
    const r = roomRef.value;
    if (r?.hasE2EESetup) {
      await r.setE2EEEnabled(false);
    }
  };

  return {
    state,
    enable,
    disable,
  };
}
