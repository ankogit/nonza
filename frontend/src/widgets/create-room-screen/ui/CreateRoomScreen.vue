<template>
  <div class="create-room-screen full-page">
    <div class="create-room-screen__container">
      <div
        v-if="!defaultOrgId && !isPreviewMode"
        class="create-room-screen__loading"
      >
        <p>Настройка организации...</p>
      </div>
      <CreateRoomForm
        v-else
        ref="formRef"
        @submit="handleCreateRoom"
        @cancel="handleCancel"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { CreateRoomForm } from "@features/create-room";
import { RoomApi } from "@entities/room";
import { OrganizationApi } from "@entities/organization";
import { ApiClient } from "@shared/api";
import type { CreateRoomRequest, Room } from "@entities/room";

const formRef = ref<InstanceType<typeof CreateRoomForm> | null>(null);

const emit = defineEmits<{
  created: [room: Room];
  cancel: [];
}>();

const apiBaseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const apiClient = new ApiClient({ baseURL: apiBaseURL });
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
        is_temporary: data.is_temporary ?? true,
        expires_at: null,
        livekit_room_name: "mock-room",
        e2ee_enabled: data.e2ee_enabled ?? false,
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

const handleCancel = () => {
  emit("cancel");
};
</script>

<style scoped>
.create-room-screen__container {
  width: 100%;
  max-width: 600px;
  flex-shrink: 0;
}

.create-room-screen__loading {
  padding: 48px;
  text-align: center;
  color: #ccc;
  font-size: 16px;
}
</style>
