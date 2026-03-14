import { onMounted, onUnmounted, ref, watch, inject, provide } from "vue";
import type { InjectionKey } from "vue";
import type { MeetingHotkeysOptions } from "./useMeetingHotkeys";

export const MEETING_SHORTCUT_BUS_KEY = Symbol(
  "meeting-shortcut-bus",
) as InjectionKey<MeetingShortcutBus>;

export interface MeetingShortcutBus {
  shortcut: { value: string | null };
}

interface MeetingShortcutPayload {
  shortcut: string;
}

function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
  if (w.__TAURI__ ?? w.__TAURI_INTERNALS__) return true;
  const env = import.meta.env as { TAURI_ENV_PLATFORM?: string };
  return typeof env.TAURI_ENV_PLATFORM === "string" && env.TAURI_ENV_PLATFORM.length > 0;
}

export function useMeetingShortcutListener(): void {
  const shortcut = ref<string | null>(null);
  provide(MEETING_SHORTCUT_BUS_KEY, { shortcut });
  const unlistenRef = ref<(() => void) | null>(null);
  const unlistenFocusRef = ref<(() => void) | null>(null);

  onMounted(async () => {
    if (!isTauri()) return;
    try {
      const { listen } = await import("@tauri-apps/api/event");
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const { invoke } = await import("@tauri-apps/api/core");
      unlistenRef.value = await listen<MeetingShortcutPayload>("meeting-shortcut", (e) => {
        shortcut.value = e.payload.shortcut;
      });
      unlistenFocusRef.value = await getCurrentWindow().listen("tauri://focus", () => {
        invoke("reregister_global_shortcuts").catch(() => {});
      });
    } catch (err) {
      console.error("[global-shortcut] listen failed:", err);
    }
  });

  onUnmounted(() => {
    unlistenRef.value?.();
    unlistenFocusRef.value?.();
  });
}

export function useTauriGlobalShortcuts(options: MeetingHotkeysOptions): void {
  const { toggleAudio, toggleVideo, toggleScreenShare, leaveRoom } = options;
  const bus = inject(MEETING_SHORTCUT_BUS_KEY);
  if (!bus) return;

  watch(
    () => bus.shortcut.value,
    (s) => {
      if (!s) return;
      const run = () => {
        switch (s) {
          case "audio":
            toggleAudio();
            break;
          case "video":
            toggleVideo?.();
            break;
          case "screen":
            toggleScreenShare?.();
            break;
          case "leave":
            leaveRoom?.();
            break;
        }
        bus.shortcut.value = null;
      };
      run();
    },
  );
}
