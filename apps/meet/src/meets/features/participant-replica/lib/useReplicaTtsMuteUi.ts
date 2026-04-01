import { ref } from "vue";
import {
  isReplicaTtsMutedIdentity,
  toggleReplicaTtsMutedIdentity,
} from "@shared/lib/participant-preferences";

export function useReplicaTtsMuteUi() {
  const tick = ref(0);

  function replicaTtsMuted(identity: string): boolean {
    void tick.value;
    return isReplicaTtsMutedIdentity(identity);
  }

  function toggleReplicaTtsMute(identity: string): void {
    toggleReplicaTtsMutedIdentity(identity);
    tick.value++;
  }

  return { replicaTtsMuted, toggleReplicaTtsMute };
}
