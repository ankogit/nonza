<template>
  <div class="create-room-screen">
    <div v-if="!defaultOrgId && !isPreviewMode" class="create-room-screen__loading">
      <MetroTile size="wide" variant="dark" title="Подготовка">
        <p class="create-room-screen__loading-text">Настройка организации…</p>
      </MetroTile>
    </div>
    <CreateRoomForm
      v-else
      ref="formRef"
      variant="metro"
      hide-header
      @submit="handleCreateRoom"
      @cancel="$emit('cancel')"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { MetroTile } from "@shared/ui";
import { CreateRoomForm } from "@features/create-room";
import { RoomApi, OrganizationApi } from "@shared/entities";
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
const isPreviewMode =
  new URLSearchParams(window.location.search).get("preview") === "true";

onMounted(async () => {
  if (isPreviewMode) return;

  try {
    const storedOrgId = localStorage.getItem("nonza_default_org_id");
    if (storedOrgId) {
      try {
        await organizationApi.getById(storedOrgId);
        defaultOrgId.value = storedOrgId;
        return;
      } catch {
        localStorage.removeItem("nonza_default_org_id");
      }
    }

    const org = await organizationApi.create({
      name: "Default Organization",
      description: "Default organization for rooms",
      meet_default: true,
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
.create-room-screen {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: safe center;
  justify-content: center;
  padding: 20px 16px 28px;
  overflow-y: auto;
  box-sizing: border-box;
}

.create-room-screen__loading,
.create-room-screen :deep(.create-room-form--metro) {
  width: min(920px, 100%);
}

.create-room-screen__loading-text {
  margin: 0;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.95rem;
}

@media (max-width: 720px) {
  .create-room-screen {
    align-items: stretch;
    padding: 16px 12px 24px;
  }

  .create-room-screen__loading,
  .create-room-screen :deep(.create-room-form--metro) {
    width: 100%;
  }
}
</style>
