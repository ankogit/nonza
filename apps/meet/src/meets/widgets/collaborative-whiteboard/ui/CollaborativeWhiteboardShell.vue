<template>
  <div class="wb-shell" :class="{ 'wb-shell--expanded': expanded }">
    <div class="wb-shell__header">
      <h3 class="wb-shell__title">Совместная доска</h3>
      <Button
        type="icon"
        size="tiny"
        variant="default"
        class="wb-shell__expand"
        :title="expanded ? 'Свернуть' : 'На весь экран'"
        :aria-label="expanded ? 'Свернуть' : 'На весь экран'"
        :aria-pressed="expanded"
        @click="expanded = !expanded"
      >
        <PixelIcon :name="expanded ? 'close' : 'fullscreen'" variant="small" />
      </Button>
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
const expanded = ref(false);

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

.wb-shell__expand {
  margin-left: auto;
  flex-shrink: 0;
}

.wb-shell--expanded {
  --wb-fs-chrome: 200px;
  position: fixed;
  inset: 0;
  z-index: 10002;
  box-sizing: border-box;
  width: min(100vw, 100dvw);
  height: min(100vh, 100dvh);
  max-width: 100vw;
  max-height: 100dvh;
  flex: none;
  border-width: 0;
  border-radius: 0;
  overflow: hidden;
  overscroll-behavior: none;
}

.wb-shell--expanded .wb-shell__header {
  padding-right: 16px;
}

.wb-shell--expanded .wb-shell__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  justify-content: center;
  align-items: center;
  padding: 8px 16px 20px;
  box-sizing: border-box;
}

.wb-shell--expanded :deep(.collab-whiteboard--embedded) {
  width: min(
    calc(100vw - 32px),
    calc((100dvh - var(--wb-fs-chrome)) * 376 / 444)
  );
  max-width: 100%;
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
