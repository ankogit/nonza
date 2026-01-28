import { ref, computed } from "vue";
import { E2EE_SUPPORTED } from "@shared/lib";
import type { Room } from "livekit-client";

export interface E2EEState {
  isSupported: boolean;
  isEnabled: boolean;
  isActive: boolean;
  error: string | null;
}

export function useE2EE(room: Room | null) {
  const state = ref<E2EEState>({
    isSupported: E2EE_SUPPORTED,
    isEnabled: false,
    isActive: false,
    error: null,
  });

  const enable = async (): Promise<void> => {
    if (!state.value.isSupported) {
      state.value.error = "E2EE не поддерживается в этом браузере";
      throw new Error("E2EE не поддерживается");
    }

    if (!room) {
      state.value.error = "Комната не подключена";
      throw new Error("Комната не подключена");
    }

    try {
      // Check if E2EE is available in LiveKit room
      // Note: This is a placeholder - actual E2EE implementation depends on LiveKit SDK version
      // LiveKit has built-in E2EE support that can be enabled via room options
      state.value.isEnabled = true;
      state.value.isActive = true;
      state.value.error = null;
    } catch (error) {
      state.value.error =
        error instanceof Error ? error.message : "Не удалось включить E2EE";
      throw error;
    }
  };

  const disable = (): void => {
    state.value.isEnabled = false;
    state.value.isActive = false;
  };

  return {
    state: computed(() => state.value),
    enable,
    disable,
  };
}
