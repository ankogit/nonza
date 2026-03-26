import { ref, watch, computed } from "vue";
import { useApiClient } from "@shared/api";
import { showToast } from "@shared/lib";
import type { OrganizationSound } from "../model/types";
import {
  getOrganizationSoundsEpoch,
  notifyOrganizationSoundsChanged,
} from "./organizationSoundsSync";

// NOTE: endpoint and type are planned; backend may not exist yet.
const ENDPOINT = (orgId: string) => `/api/v1/org/${encodeURIComponent(orgId)}/sounds`;

export function useOrganizationSounds(orgId: () => string | null | undefined) {
  const client = useApiClient();
  const soundsRaw = ref<OrganizationSound[]>([]);
  const isLoading = ref(false);
  const orgSoundsEpoch = getOrganizationSoundsEpoch();

  async function refresh() {
    const id = orgId();
    if (!id) {
      soundsRaw.value = [];
      return;
    }

    isLoading.value = true;
    try {
      const res = await client.get<OrganizationSound[]>(ENDPOINT(id));
      soundsRaw.value = Array.isArray(res)
        ? res.map((s) => ({
            ...s,
            loopEnabled: Boolean((s as unknown as Partial<OrganizationSound>).loopEnabled),
            gateEnabled: Boolean((s as unknown as Partial<OrganizationSound>).gateEnabled),
            volume: Number((s as unknown as Partial<OrganizationSound>).volume ?? 100),
            speed: Number((s as unknown as Partial<OrganizationSound>).speed ?? 100),
          }))
        : [];
    } catch {
      soundsRaw.value = [];
      showToast("Не удалось загрузить звуки", { variant: "warning" });
    } finally {
      isLoading.value = false;
    }
  }

  watch(
    () => {
      const id = orgId();
      if (!id) return [null, 0] as const;
      return [id, orgSoundsEpoch.value[id] ?? 0] as const;
    },
    () => refresh(),
    { immediate: true },
  );

  async function deleteSound(soundId: string) {
    const id = orgId();
    if (!id) return;
    try {
      await client.delete(
        `${ENDPOINT(id)}/${encodeURIComponent(soundId)}`,
      );
      notifyOrganizationSoundsChanged(id);
    } catch {
      showToast("Не удалось удалить звук", { variant: "danger" });
    }
  }

  return {
    sounds: computed(() => soundsRaw.value),
    isLoading,
    refresh,
    deleteSound,
  };
}

