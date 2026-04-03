<template>
  <div class="call-menu-drawer" role="dialog" aria-label="Виджеты">
    <header class="call-menu-drawer__head" @dragover="emit('paletteDragover', $event)" @drop="emit('paletteDrop', $event)">
      <h2 class="call-menu-drawer__title font-bebas">Виджеты</h2>
      <Button variant="default" size="small" title="Закрыть" aria-label="Закрыть" @click="emit('close')">
        <PixelIcon name="close" variant="small" />
      </Button>
    </header>

    <div class="call-menu-drawer__wrap" @dragover="emit('paletteDragover', $event)" @drop="emit('paletteDrop', $event)">
      <div class="call-menu-drawer__toolbar">
        <Button
          type="icon"
          size="tiny"
          variant="default"
          class="call-menu-drawer__arrange-toggle"
          :class="{ active: arrangeMode }"
          :title="arrangeMode ? 'Готово' : 'Настроить слоты на панели'"
          :aria-pressed="arrangeMode"
          aria-label="Настройка слотов"
          @click="emit('toggleArrange')"
        >
          <PixelIcon name="settings" variant="small" />
        </Button>
        <span v-if="arrangeMode" class="call-menu-drawer__mode-label">
          Слоты: перетаскивание; снять — двойной клик ⋮, на «Виджеты» или в список
        </span>
      </div>

      <div
        class="call-menu-drawer__list call-menu-drawer__list--scroll"
        @dragover="emit('paletteDragover', $event)"
        @drop="emit('paletteDrop', $event)"
      >
        <template v-for="entry in entries" :key="'pal-' + entry.id">
          <div
            v-if="arrangeMode"
            class="call-menu-drawer__row"
            @dragover="emit('paletteDragover', $event)"
            @drop="emit('paletteDrop', $event)"
          >
            <button
              type="button"
              class="call-menu-drawer__palette-grip"
              draggable="true"
              :title="'В слот: ' + entry.label"
              @dragstart="emit('dragFromPalette', $event, entry.id)"
              @dragover="emit('paletteDragover', $event)"
              @drop="emit('paletteDrop', $event)"
              @click.stop
            >
              <span class="call-menu-drawer__grip-dots" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="call-menu-chip call-menu-chip--arrange"
              :class="{ 'call-menu-chip--on': isWidgetActive(entry.id) }"
              draggable="true"
              :title="'В слот: ' + entry.label"
              :aria-pressed="isWidgetActive(entry.id)"
              @dragstart="emit('dragFromPalette', $event, entry.id)"
              @dragover="emit('paletteDragover', $event)"
              @drop="emit('paletteDrop', $event)"
              @click="emit('pinFromPalette', entry.id)"
            >
              <PixelIcon :name="entry.icon" variant="small" />
              <span class="call-menu-chip__label">{{ entry.label }}</span>
            </button>
          </div>
          <button
            v-else
            type="button"
            class="call-menu-chip call-menu-chip--pick"
            :class="{ 'call-menu-chip--on': isWidgetActive(entry.id) }"
            :title="'Открыть: ' + entry.label"
            :aria-pressed="isWidgetActive(entry.id)"
            @click="emit('openEntry', entry.id)"
          >
            <PixelIcon :name="entry.icon" variant="small" />
            <span class="call-menu-chip__label">{{ entry.label }}</span>
          </button>
        </template>

        <div
          v-if="entries.length === 0"
          class="call-menu-drawer__empty"
          @dragover="emit('paletteDragover', $event)"
          @drop="emit('paletteDrop', $event)"
        >
          <p class="call-menu-drawer__empty-title">Все виджеты на панели</p>
          <p class="call-menu-drawer__empty-hint">
            Снять: двойной клик ⋮, перетащи на «Виджеты» или в это окно.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CallWidgetId } from "@features/call-widgets";
import { Button, PixelIcon } from "@shared/ui";
import type { PaletteEntry } from "../model";

const props = defineProps<{
  entries: PaletteEntry[];
  arrangeMode: boolean;
  activeWidgetIds: CallWidgetId[];
}>();

function isWidgetActive(id: CallWidgetId): boolean {
  return props.activeWidgetIds.includes(id);
}

const emit = defineEmits<{
  close: [];
  toggleArrange: [];
  paletteDragover: [ev: DragEvent];
  paletteDrop: [ev: DragEvent];
  dragFromPalette: [ev: DragEvent, id: CallWidgetId];
  pinFromPalette: [id: CallWidgetId];
  openEntry: [id: CallWidgetId];
}>();
</script>

<style scoped>
.call-menu-drawer {
  display: flex;
  flex-direction: column;
  position: absolute;
  z-index: 1;
  pointer-events: auto;
  left: auto;
  right: max(20px, env(safe-area-inset-right, 0px));
  bottom: max(110px, calc(52px + env(safe-area-inset-bottom, 0px) + 12px));
  width: min(320px, calc(100vw - 20px - env(safe-area-inset-left, 0px)));
  max-width: min(320px, calc(100vw - 20px));
  margin: 0;
  padding: 14px;
  padding-bottom: max(14px, env(safe-area-inset-bottom, 0px));
  background: rgba(22, 22, 22, 0.98);
  border: 2px solid #3d3d3d;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.4);
  box-sizing: border-box;
  max-height: min(70vh, 420px);
  overflow: hidden;
}

.call-menu-drawer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.call-menu-drawer__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 400;
  letter-spacing: 0.04em;
  color: #e8e4df;
}

.call-menu-drawer__wrap {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  min-width: 0;
  flex: 1 1 auto;
  min-height: 0;
}

.call-menu-drawer__toolbar {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.call-menu-drawer__arrange-toggle.active {
  border-color: rgba(255, 200, 100, 0.55);
  background: rgba(255, 200, 100, 0.12);
}

.call-menu-drawer__mode-label {
  font-size: 11px;
  color: rgba(255, 200, 100, 0.85);
  line-height: 1.25;
}

.call-menu-drawer__row {
  display: flex;
  width: 100%;
  gap: 8px;
  align-items: center;
}

.call-menu-drawer__palette-grip {
  flex-shrink: 0;
  width: 28px;
  min-height: 40px;
  padding: 0;
  margin: 0;
  border: 2px solid #555;
  background: rgba(255, 255, 255, 0.06);
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  box-sizing: border-box;
}

.call-menu-drawer__palette-grip:active {
  cursor: grabbing;
}

.call-menu-drawer__grip-dots {
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

.call-menu-drawer__list {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.call-menu-drawer__list--scroll {
  flex: 1 1 auto;
  flex-direction: column;
  flex-wrap: nowrap;
  align-items: stretch;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  max-height: min(52vh, 340px);
}

.call-menu-drawer__list--scroll .call-menu-chip--arrange {
  flex: 1;
  min-width: 0;
  justify-content: flex-start;
}

.call-menu-chip {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: 2px solid #444;
  background: #1e1e1e;
  color: #bab1a8;
  font-size: 11px;
  white-space: nowrap;
  max-width: 140px;
}

.call-menu-chip__label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.call-menu-chip--pick {
  cursor: pointer;
  width: 100%;
  max-width: none;
  justify-content: flex-start;
  text-align: left;
  border-color: #3a3a3a;
}

.call-menu-chip--pick:hover {
  border-color: #555;
  background: #242424;
}

.call-menu-chip--on {
  border-color: #2980b9;
  background: #1a3d52;
  color: #e8f4fc;
}

.call-menu-chip--on:hover {
  border-color: #3a91c9;
  background: #214a63;
}

.call-menu-chip--arrange {
  cursor: grab;
}

.call-menu-chip--arrange:active {
  cursor: grabbing;
}

.call-menu-drawer__list--scroll .call-menu-chip {
  max-width: none;
}

.call-menu-drawer__empty {
  min-height: 100px;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 2px dashed rgba(255, 255, 255, 0.12);
  box-sizing: border-box;
}

.call-menu-drawer__empty-title {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  text-align: center;
}

.call-menu-drawer__empty-hint {
  margin: 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.38);
  text-align: center;
  line-height: 1.35;
  max-width: 260px;
}

@media (max-width: 639px) {
  .call-menu-drawer {
    width: min(320px, calc(100vw - 16px - env(safe-area-inset-left, 0px)));
    right: max(8px, env(safe-area-inset-right, 0px));
  }
}
</style>
