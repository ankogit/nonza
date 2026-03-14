<template>
  <div
    class="app__view grain-overlay"
    :class="{ 'app__view--scroll': needsScroll }"
  >
    <UiKitPage v-if="showUiKit" />
    <PreviewMode v-else-if="isPreviewMode" />
    <Modal
      v-else-if="createdRoom"
      :model-value="true"
      :close-on-overlay-click="true"
      @close="createdRoom = null"
    >
      <RoomCreated
        :key="createdRoom.id"
        :room="createdRoom"
        embedded
        @close="createdRoom = null"
        @join="handleJoinRoom"
      />
    </Modal>
    <CreateRoomScreen
      v-else-if="showCreateRoom"
      @created="handleRoomCreated"
      @cancel="showCreateRoom = false"
    />
    <NonzaWidget
      v-else
      :api-client="apiClient"
      :api-base-u-r-l="apiBaseURL"
      :livekit-u-r-l="livekitURL"
      :sync-url-with-room-code="true"
    />
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, provide } from "vue";
import NonzaWidget from "./NonzaWidget.vue";
import {
  useMeetingShortcutListener,
  getApiBaseURL,
  getLivekitURL,
  API_BASE_URL_INJECT_KEY,
  LIVEKIT_URL_INJECT_KEY,
} from "@shared/lib";
import { useApiClient } from "@shared/api";
import PreviewMode from "./PreviewMode.vue";
import UiKitPage from "./UiKitPage.vue";
import { Modal, ToastContainer } from "@shared/ui";
import { CreateRoomScreen } from "@widgets/create-room-screen";
import { RoomCreated } from "@widgets/room-created";
import type { Room } from "@shared/entities";

const showUiKit = ref(false);
const isPreviewMode = ref(false);
const showCreateRoom = ref(false);
const createdRoom = ref<Room | null>(null);
useMeetingShortcutListener();

const needsScroll = computed(
  () => showUiKit.value || isPreviewMode.value || showCreateRoom.value,
);
const apiBaseURL = getApiBaseURL();
const livekitURL = getLivekitURL();
const apiClient = useApiClient();
provide(API_BASE_URL_INJECT_KEY, apiBaseURL);
provide(LIVEKIT_URL_INJECT_KEY, livekitURL);

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search);
  showUiKit.value =
    urlParams.get("ui-kit") === "true" || urlParams.get("page") === "ui-kit";
  isPreviewMode.value =
    !showUiKit.value &&
    (urlParams.get("preview") === "true" || urlParams.get("mode") === "preview");
  showCreateRoom.value =
    !showUiKit.value &&
    (urlParams.get("create") === "true" || urlParams.get("action") === "create");

  // Auto-fill room code from URL if provided
  const code = urlParams.get("code");
  if (code && !showCreateRoom.value && !isPreviewMode.value) {
    // Will be handled by NonzaWidget component
  }
});

const handleRoomCreated = (room: Room) => {
  createdRoom.value = room;
  showCreateRoom.value = false;
};

const handleJoinRoom = (room: Room) => {
  // Navigate to join room with the code
  if (room.short_code) {
    window.location.href = `/?code=${room.short_code}`;
  }
  createdRoom.value = null;
};
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.app__view {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app__view--scroll {
  overflow-y: auto;
  overflow-x: hidden;
}
</style>
