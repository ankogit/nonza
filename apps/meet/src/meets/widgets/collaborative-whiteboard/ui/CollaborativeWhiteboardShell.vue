<template>
  <div class="wb-shell">
    <div class="wb-shell__header">
      <h3 class="wb-shell__title">Совместная доска</h3>
      <!--
      <Button
        type="text"
        size="tiny"
        variant="default"
        class="wb-shell__studio"
        title="Открыть студию"
        @click="mode = 'studio'"
      >
        Студия
      </Button>
      -->
      <div v-if="connectionStatus !== 'connected'" class="wb-shell__status">
        {{
          connectionStatus === "connecting" ? "Подключение..." : "Отключено"
        }}
      </div>
    </div>
    <div class="wb-shell__body">
      <CollaborativeWhiteboard
        v-if="mode === 'simple'"
        embedded
        :participant-color="participantColor"
        :room-id="roomId"
      />
      <p v-else class="wb-shell__studio-placeholder">
        Студия открыта на весь экран. Закройте студию крестиком в углу.
      </p>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="mode === 'studio'"
      class="room-fullscreen"
      role="dialog"
      aria-label="Студия"
    >
      <Button
        variant="default"
        size="small"
        class="room-fullscreen__close"
        title="Закрыть студию"
        aria-label="Закрыть студию"
        @click="mode = 'simple'"
      >
        <PixelIcon name="close" variant="large" />
      </Button>
      <div class="room-fullscreen__editor">
        <CollaborativeWhiteboardStudio
          :participant-color="participantColor"
          :room-id="roomId"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, inject } from "vue";
import { Button, PixelIcon } from "@shared/ui";
import { MEET_ROOM_COLLABORATION_KEY } from "@features/room-collaboration";
import CollaborativeWhiteboard from "./CollaborativeWhiteboard.vue";
import CollaborativeWhiteboardStudio from "./CollaborativeWhiteboardStudio.vue";

defineProps<{
  participantColor: string;
  roomId?: string | null;
}>();

const mode = ref<"simple" | "studio">("simple");

const collab = inject(MEET_ROOM_COLLABORATION_KEY, null);
const connectionStatus = computed(() => {
  if (!collab) return "disconnected" as const;
  return collab.connectionStatus.value;
});
</script>

<style scoped>
.wb-shell {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  width: 100%;
  height: auto;
  min-height: 0;
  background: #1f1f1f;
  border: 2px solid #444;
  box-sizing: border-box;
  overflow: visible;
}

.wb-shell__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 2px solid #444;
  background: #2a2a2a;
  flex-shrink: 0;
}

.wb-shell__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #bab1a8;
  font-family: "Bebas Neue", sans-serif;
  letter-spacing: 0.02em;
}

.wb-shell__studio {
  margin-left: auto;
  flex-shrink: 0;
}

.wb-shell__status {
  font-size: 12px;
  color: #e2534b;
  width: 100%;
  flex-basis: 100%;
}

.wb-shell__body {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  overflow: visible;
}

.wb-shell__studio-placeholder {
  margin: 0;
  padding: 16px;
  font-size: 13px;
  line-height: 1.4;
  color: #999;
}
</style>
