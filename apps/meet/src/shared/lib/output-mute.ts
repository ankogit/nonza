import { ref } from "vue";
import { showToast } from "./useToasts";

const outputMuted = ref(false);

export function getOutputMuted(): boolean {
  return outputMuted.value;
}

export function setOutputMuted(muted: boolean): void {
  outputMuted.value = muted;
}

export function toggleOutputMuted(): boolean {
  outputMuted.value = !outputMuted.value;
  showToast(
    outputMuted.value ? "Звук отключён" : "Звук включён",
    { variant: "info", duration: 2000 },
  );
  return outputMuted.value;
}

export function useOutputMuted() {
  return outputMuted;
}
