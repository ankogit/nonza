<template>
  <div
    class="call-menu-slot"
    :data-widget-slot="slotId ?? undefined"
    :class="{
      'call-menu-slot--empty': slotId == null,
      'call-menu-slot--arrange': arrangeMode,
      'call-menu-slot--drop-target': dropHighlight,
    }"
    @dragover="emit('dragover', $event, index)"
    @drop="emit('drop', $event, index)"
  >
    <template v-if="slotId">
      <button
        v-if="arrangeMode"
        type="button"
        class="call-menu-slot__grip"
        :title="gripTitle"
        draggable="true"
        @dragstart="emit('dragstartFromSlot', $event, slotId, index)"
        @dblclick.stop="emit('gripDblclick', index, slotId)"
      >
        <span class="call-menu-slot__grip-dots" aria-hidden="true" />
      </button>
      <div
        class="call-menu-slot__body"
        :draggable="arrangeMode"
        @dragstart="emit('dragstartFromSlot', $event, slotId, index)"
      >
        <slot name="widget" />
      </div>
    </template>
    <div v-else class="call-menu-slot__placeholder" />
  </div>
</template>

<script setup lang="ts">
import type { CallWidgetId } from "@features/call-widgets";

defineProps<{
  index: number;
  slotId: CallWidgetId | null;
  arrangeMode: boolean;
  dropHighlight: boolean;
  gripTitle: string;
}>();

const emit = defineEmits<{
  dragover: [ev: DragEvent, index: number];
  drop: [ev: DragEvent, index: number];
  dragstartFromSlot: [ev: DragEvent, id: CallWidgetId, index: number];
  gripDblclick: [index: number, id: CallWidgetId];
}>();
</script>

<style scoped>
.call-menu-slot {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: transparent;
  box-sizing: border-box;
}

.call-menu-slot--arrange {
  min-height: calc(48px + 4px);
  padding: 2px 4px;
  border: 2px dashed rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 200, 100, 0.35);
  background: rgba(255, 200, 100, 0.06);
}

.call-menu-slot.call-menu-slot--drop-target {
  background: rgba(120, 210, 255, 0.14);
  box-shadow: 0 0 0 2px rgba(100, 190, 255, 0.4);
}

.call-menu-slot--arrange.call-menu-slot--drop-target {
  border-color: rgba(120, 210, 255, 0.85);
}

.call-menu-slot--empty {
  min-width: 48px;
  justify-content: center;
}

.call-menu-slot__placeholder {
  box-sizing: border-box;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border: 2px dashed rgba(255, 255, 255, 0.2);
  border-radius: 0;
  background: transparent;
}

.call-menu-slot__grip {
  flex-shrink: 0;
  width: 14px;
  height: 48px;
  padding: 0;
  margin: 0;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 200, 100, 0.75);
}

.call-menu-slot__grip:active {
  cursor: grabbing;
}

.call-menu-slot__grip-dots {
  display: block;
  width: 4px;
  height: 14px;
  background: linear-gradient(
    to bottom,
    currentColor 0,
    currentColor 30%,
    transparent 30%,
    transparent 36%,
    currentColor 36%,
    currentColor 66%,
    transparent 66%,
    transparent 72%,
    currentColor 72%,
    currentColor 100%
  );
}

.call-menu-slot--arrange .call-menu-slot__body {
  cursor: grab;
}

.call-menu-slot--arrange .call-menu-slot__body:active {
  cursor: grabbing;
}

.call-menu-slot--arrange .call-menu-slot__body :deep(.button) {
  pointer-events: none;
}

.call-menu-slot__body {
  display: flex;
  align-items: center;
  min-width: 0;
}

.call-menu-slot__body :deep(.sound-bar) {
  position: relative;
  z-index: 1;
}

.call-menu-slot__body :deep(.sound-bar__popover) {
  z-index: 10050;
}

@media (max-width: 768px) {
  .call-menu-slot--arrange {
    min-height: calc(40px + 4px);
  }

  .call-menu-slot--empty {
    min-width: 40px;
  }

  .call-menu-slot__placeholder {
    width: 40px;
    height: 40px;
  }

  .call-menu-slot__grip {
    height: 40px;
  }
}

@media (max-width: 480px) {
  .call-menu-slot--arrange {
    min-height: calc(36px + 4px);
  }

  .call-menu-slot--empty {
    min-width: 36px;
  }

  .call-menu-slot__placeholder {
    width: 36px;
    height: 36px;
  }

  .call-menu-slot__grip {
    height: 36px;
  }
}
</style>
