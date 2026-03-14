import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { Organization } from "@shared/entities";
import type { OrganizationApi } from "@shared/entities";

export const useOrganizationsStore = defineStore("organizations", () => {
  const list = ref<Organization[]>([]);
  const loading = ref(false);
  const selectedId = ref<string | null>(null);

  const organizations = computed(() => list.value);
  const selectedOrgId = computed(() => selectedId.value);
  const selectedOrganization = computed(() =>
    selectedId.value
      ? list.value.find((o) => o.id === selectedId.value) ?? null
      : null,
  );

  async function loadOrganizations(api: OrganizationApi) {
    loading.value = true;
    try {
      const result = await api.getList();
      list.value = result;
    } catch (e) {
      console.error("Failed to load organizations:", e);
    } finally {
      loading.value = false;
    }
  }

  function setSelectedId(id: string | null) {
    selectedId.value = id;
  }

  function addOrganization(org: Organization) {
    const idx = list.value.findIndex((o) => o.id === org.id);
    if (idx === -1) {
      list.value = [org, ...list.value];
    }
  }

  function clearSelected() {
    selectedId.value = null;
  }

  return {
    organizations,
    loading,
    selectedOrgId,
    selectedOrganization,
    loadOrganizations,
    setSelectedId,
    addOrganization,
    clearSelected,
  };
});
