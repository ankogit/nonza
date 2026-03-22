import { ref, watchEffect, type Ref } from "vue";

export const APP_OST_SRC = "/sounds/turtules_nonza.mp3";

export function useAppOst(
  shouldPlay: Ref<boolean>,
  audioEl: Ref<HTMLAudioElement | null>,
) {
  const muted = ref(true);

  watchEffect(() => {
    const el = audioEl.value;
    if (!el) return;
    if (!shouldPlay.value || muted.value) {
      el.pause();
    } else {
      void el.play().catch(() => {});
    }
  });

  function toggleMute() {
    muted.value = !muted.value;
  }

  return { muted, toggleMute };
}
