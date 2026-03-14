<template>
  <Modal
    :model-value="true"
    title="Создать комнату"
    :close-on-overlay-click="true"
    @close="$emit('cancel')"
  >
    <div v-if="!defaultOrgId && !isPreviewMode" class="create-room-screen__loading">
      <p>Настройка организации...</p>
    </div>
    <CreateRoomForm
      v-else
      ref="formRef"
      hide-header
      @submit="handleCreateRoom"
      @cancel="$emit('cancel')"
    />
  </Modal>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { Modal } from "@shared/ui";
import { CreateRoomForm } from "@features/create-room";
import { RoomApi } from "@shared/entities";
import { OrganizationApi } from "@shared/entities";
import { useApiClient } from "@shared/api";
import type { CreateRoomRequest, Room } from "@shared/entities";

const formRef = ref<InstanceType<typeof CreateRoomForm> | null>(null);

const emit = defineEmits<{
  created: [room: Room];
  cancel: [];
}>();

const apiClient = useApiClient();
const roomApi = new RoomApi(apiClient);
const organizationApi = new OrganizationApi(apiClient);

const defaultOrgId = ref<string | null>(null);
// Preview только по явному ?preview=true (на проде без этого параметра идём в реальный API)
const isPreviewMode =
  new URLSearchParams(window.location.search).get("preview") === "true";

// Get or create default organization
onMounted(async () => {
  if (isPreviewMode) return;

  try {
    // Try to get default organization from localStorage
    const storedOrgId = localStorage.getItem("nonza_default_org_id");
    if (storedOrgId) {
      try {
        await organizationApi.getById(storedOrgId);
        defaultOrgId.value = storedOrgId;
        return;
      } catch {
        // Organization doesn't exist, create new one
        localStorage.removeItem("nonza_default_org_id");
      }
    }

    // Create default organization
    const org = await organizationApi.create({
      name: "Default Organization",
      description: "Default organization for rooms",
    });
    defaultOrgId.value = org.id;
    localStorage.setItem("nonza_default_org_id", org.id);
  } catch (error) {
    console.error("Failed to setup organization:", error);
  }
});

const handleCreateRoom = async (data: CreateRoomRequest) => {
  try {
    if (isPreviewMode) {
      // Mock room for preview
      const mockRoom: Room = {
        id: "mock-id",
        organization_id: "mock-org-id",
        name: data.name,
        short_code: "abc-defg-hij",
        room_type: data.room_type,
        is_temporary: data.is_temporary ?? false,
        expires_at: null,
        livekit_room_name: "mock-room",
        e2ee_enabled: data.e2ee_enabled ?? false,
        position: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      emit("created", mockRoom);
    } else {
      if (!defaultOrgId.value) {
        const errorMsg =
          "Организация не готова. Подождите немного и попробуйте снова.";
        formRef.value?.setError?.(errorMsg);
        throw new Error(errorMsg);
      }

      const room = await roomApi.create(defaultOrgId.value, data);
      emit("created", room);
    }
  } catch (error) {
    console.error("Failed to create room:", error);
    const errorMsg =
      error instanceof Error ? error.message : "Не удалось создать комнату";
    formRef.value?.setError?.(errorMsg);
    throw error;
  }
};
</script>

<style scoped>
.create-room-screen__loading {
  padding: 24px;
  text-align: center;
  color: #bab1a8;
  font-size: 16px;
}
</style>
