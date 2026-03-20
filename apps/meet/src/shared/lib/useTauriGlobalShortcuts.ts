import { onMounted, onUnmounted, ref, watch, inject, provide } from "vue";
import type { InjectionKey } from "vue";
import type { MeetingHotkeysOptions } from "./useMeetingHotkeys";
import {
  getStoredShortcuts,
  mouseEventToShortcut,
  keyEventToShortcut,
  pointerEventToShortcut,
  isMouseShortcut,
} from "./desktopShortcuts";

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
  const {
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    leaveRoom,
    toggleOutputMute,
    enabled,
  } = options;
  const bus = inject(MEETING_SHORTCUT_BUS_KEY);
  const shortcutsRef = ref(getStoredShortcuts());
  const mouseListenerActive = ref(false);

  function isInputTarget(target: EventTarget | null): boolean {
    if (!target || !(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    return target.isContentEditable;
  }

  let handlePointerDown: ((e: PointerEvent) => void) | null = null;
  let handleMouseDown: ((e: MouseEvent) => void) | null = null;
  let handleKeyDown: ((e: KeyboardEvent) => void) | null = null;

  onMounted(async () => {
    if (!isTauri()) return;
    shortcutsRef.value = getStoredShortcuts();

    // Wait for Rust listener status before wiring JS handlers.
    // This prevents double-triggering when both Rust + WebView react.
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      mouseListenerActive.value = await invoke("is_mouse_listener_active");
      console.info(
        "[mouse-shortcut] rust mouse listener active:",
        mouseListenerActive.value,
      );
    } catch {
      mouseListenerActive.value = false;
    }
    handlePointerDown = (e: PointerEvent) => {
      if (!enabled()) return;
      if (isInputTarget(e.target)) return;

      const s = pointerEventToShortcut(e);
      if (!s) return;
      if (mouseListenerActive.value && isMouseShortcut(s)) return;

      e.preventDefault();
      e.stopPropagation();

      // Обновляем из localStorage на случай, если пользователь поменял хоткей в настройках.
      shortcutsRef.value = getStoredShortcuts();
      const cur = shortcutsRef.value;

      let action: string | null = null;
      if (s === cur.audio) {
        action = "audio";
      } else if (s === cur.video && toggleVideo) {
        action = "video";
      } else if (s === cur.sound && toggleOutputMute) {
        action = "sound";
      } else if (s === cur.leave && leaveRoom) {
        action = "leave";
      }

      if (!action) return;

      console.info("[mouse-shortcut] pointer", {
        s,
        action,
        button: e.button,
      });

      // Rust эмитит "meeting-shortcut", а обработчик в этом же модуле вызывает нужное действие.
      void (async () => {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("trigger_meeting_shortcut", { shortcut: action });
        } catch {
          // ignore
        }
      })();
    };
    handleMouseDown = (e: MouseEvent) => {
      if (!enabled()) return;
      if (isInputTarget(e.target)) return;

      const s = mouseEventToShortcut(e);
      if (!s) return;
      if (mouseListenerActive.value && isMouseShortcut(s)) return;

      e.preventDefault();
      e.stopPropagation();

      shortcutsRef.value = getStoredShortcuts();
      const cur = shortcutsRef.value;

      let action: string | null = null;
      if (s === cur.audio) {
        action = "audio";
      } else if (s === cur.video && toggleVideo) {
        action = "video";
      } else if (s === cur.sound && toggleOutputMute) {
        action = "sound";
      } else if (s === cur.leave && leaveRoom) {
        action = "leave";
      }

      if (!action) return;

      console.info("[mouse-shortcut] mousedown", {
        s,
        action,
        button: e.button,
      });

      void (async () => {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("trigger_meeting_shortcut", { shortcut: action });
        } catch {
          // ignore
        }
      })();
    };
    handleKeyDown = (e: KeyboardEvent) => {
      if (!enabled()) return;
      if (isInputTarget(e.target)) return;

      const s = keyEventToShortcut(e);
      if (!s) return;
      if (mouseListenerActive.value && isMouseShortcut(s)) return;

      const cur = getStoredShortcuts();
      let action: string | null = null;
      if (s === cur.audio) action = "audio";
      else if (s === cur.video && toggleVideo) action = "video";
      else if (s === cur.sound && toggleOutputMute) action = "sound";
      else if (s === cur.leave && leaveRoom) action = "leave";
      else return;

      e.preventDefault();
      e.stopPropagation();

      console.info("[mouse-shortcut] keydown", {
        s,
        action,
        key: e.key,
        code: e.code,
      });

      void (async () => {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("trigger_meeting_shortcut", { shortcut: action });
        } catch {
          // ignore
        }
      })();
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("mousedown", handleMouseDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
  });

  onUnmounted(() => {
    if (handlePointerDown) {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    }
    if (handleMouseDown) {
      document.removeEventListener("mousedown", handleMouseDown, true);
    }
    if (handleKeyDown) {
      document.removeEventListener("keydown", handleKeyDown, true);
    }
  });

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
          case "sound":
            toggleOutputMute?.();
            break;
        }
        bus.shortcut.value = null;
      };
      run();
    },
  );
}
