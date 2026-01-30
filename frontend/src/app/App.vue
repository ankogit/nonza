<template>
  <UiKitPage v-if="showUiKit" />
  <PreviewMode v-else-if="isPreviewMode" />
  <RoomCreated
    v-else-if="createdRoom"
    :room="createdRoom"
    @close="createdRoom = null"
    @join="handleJoinRoom"
  />
  <CreateRoomScreen
    v-else-if="showCreateRoom"
    @created="handleRoomCreated"
    @cancel="showCreateRoom = false"
  />
  <NonzaWidget
    v-else
    :api-base-u-r-l="apiBaseURL"
    :livekit-u-r-l="livekitURL"
  />
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import NonzaWidget from "./NonzaWidget.vue";
import PreviewMode from "./PreviewMode.vue";
import UiKitPage from "./UiKitPage.vue";
import { CreateRoomScreen } from "@widgets/create-room-screen";
import { RoomCreated } from "@widgets/room-created";
import type { Room } from "@entities/room";

const showUiKit = ref(false);
const isPreviewMode = ref(false);
const showCreateRoom = ref(false);
const createdRoom = ref<Room | null>(null);
const apiBaseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const livekitURL = import.meta.env.VITE_LIVEKIT_URL || "ws://localhost:7880";

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
  width: 100vw;
  height: 100vh;
}
</style>
