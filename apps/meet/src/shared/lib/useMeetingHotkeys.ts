import { onMounted, onUnmounted } from "vue";

function isInputTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  return target.isContentEditable;
}

export interface MeetingHotkeysOptions {
  toggleAudio: () => void;
  toggleVideo?: () => void;
  toggleScreenShare?: () => void;
  leaveRoom?: () => void;
  enabled: () => boolean;
}

export function useMeetingHotkeys(options: MeetingHotkeysOptions): void {
  const {
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    leaveRoom,
    enabled,
  } = options;

  function handleKeydown(e: KeyboardEvent) {
    if (!enabled()) return;
    if (isInputTarget(e.target)) return;

    const key = e.key.toLowerCase();
    if (key === "m") {
      e.preventDefault();
      toggleAudio();
      return;
    }
    if (key === "v" && toggleVideo) {
      e.preventDefault();
      toggleVideo();
      return;
    }
    if (key === "s" && e.shiftKey && toggleScreenShare) {
      e.preventDefault();
      toggleScreenShare();
      return;
    }
    if (key === "h" && leaveRoom) {
      e.preventDefault();
      leaveRoom();
    }
  }

  onMounted(() => {
    document.addEventListener("keydown", handleKeydown);
  });

  onUnmounted(() => {
    document.removeEventListener("keydown", handleKeydown);
  });
}
