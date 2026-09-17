<template>
  <div
    ref="menuRootRef"
    class="call-menu menu bg-dark-20"
    :class="[
      menuClass,
      {
        'call-menu--widgets-open': paletteOpen,
        'call-menu--has-widgets': showWidgetSystem,
        'call-menu--arrange': paletteArrangeMode,
        'call-menu--has-replica': Boolean($slots.replica),
      },
    ]"
  >
    <div
      class="call-menu__bar"
      :class="{ 'call-menu__bar--has-replica': Boolean($slots.replica) }"
    >
      <div class="call-menu__start">
        <div class="left">
          <slot name="left" />
        </div>
        <div v-if="$slots.replica" class="call-menu__replica">
          <slot name="replica" />
        </div>
      </div>
      <div class="center">
        <slot name="center">
          <Button
            variant="danger"
            title="Закончить разговор"
            @click="emit('disconnect')"
          >
            <PixelIcon name="hangup" variant="large" />
          </Button>
        </slot>
      </div>
      <div class="right">
        <slot name="right" />
        <div v-if="showWidgetSystem" class="call-menu__widget-system">
          <div class="call-menu__pinned-scroll">
            <CallMenuSlotRow
              v-for="item in visibleSlotItems"
              :key="'slot-' + item.index + '-' + String(item.slotId)"
              :index="item.index"
              :slot-id="item.slotId"
              :arrange-mode="paletteArrangeMode"
              :drop-highlight="slotDropHighlightIndex === item.index"
              :grip-title="
                item.slotId
                  ? 'Перетащить или двойной клик — снять: ' + labelFor(item.slotId)
                  : ''
              "
              @dragover="(e, i) => onSlotDragOver(e, i)"
              @drop="(e, i) => onDropOnSlot(e, i)"
              @dragstart-from-slot="(e, id, i) => onDragFromSlot(e, id, i)"
              @grip-dblclick="(i, id) => onSlotGripDblClick(i, id)"
            >
              <template v-if="item.slotId" #widget>
                <slot :name="widgetSlotName(item.slotId)" />
              </template>
            </CallMenuSlotRow>
          </div>

          <CallMenuPaletteOpener
            :title="paletteOpenerTitle"
            unpin-title="Снять с панели"
            :palette-open="paletteOpen"
            :unpin-hover="paletteOpenerUnpinHover"
            @click="onPaletteOpenerClick"
            @dragover="onPaletteOpenerDragOver"
            @dragleave="onPaletteOpenerDragLeave"
            @drop="onPaletteOpenerDrop"
          />
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showWidgetSystem && paletteOpen"
        class="call-menu__widgets-overlay"
      >
        <CallMenuWidgetsDrawer
          :entries="paletteEntries"
          :arrange-mode="paletteArrangeMode"
          :active-widget-ids="activeCallWidgetIds"
          @close="paletteOpen = false"
          @toggle-arrange="paletteArrangeMode = !paletteArrangeMode"
          @palette-dragover="onPaletteDragOver"
          @palette-drop="onPaletteDrop"
          @drag-from-palette="(e, id) => onDragFromPalette(e, id)"
          @pin-from-palette="pinFromPaletteInArrangeMode"
          @open-entry="activateWidgetFromPaletteChip"
        />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, toRef } from "vue";
import type { CallWidgetId } from "@features/call-widgets";
import { Button, PixelIcon } from "@shared/ui";
import type { CallMenuProps } from "../model";
import { useCallMenu } from "../model";
import CallMenuPaletteOpener from "./CallMenuPaletteOpener.vue";
import CallMenuSlotRow from "./CallMenuSlotRow.vue";
import CallMenuWidgetsDrawer from "./CallMenuWidgetsDrawer.vue";
import "./callMenuDnd.css";

const props = withDefaults(defineProps<CallMenuProps>(), {
  roomId: null,
  activeCallWidgetIds: () => [],
});

const emit = defineEmits<{
  disconnect: [];
  activateCallWidget: [id: CallWidgetId];
}>();

const menuRootRef = ref<HTMLElement | null>(null);

const {
  showWidgetSystem,
  paletteOpen,
  paletteArrangeMode,
  slotDropHighlightIndex,
  paletteOpenerUnpinHover,
  visibleSlotItems,
  paletteEntries,
  widgetSlotName,
  labelFor,
  onDragFromPalette,
  onDragFromSlot,
  onSlotDragOver,
  onDropOnSlot,
  onSlotGripDblClick,
  onPaletteDragOver,
  onPaletteDrop,
  onPaletteOpenerDragOver,
  onPaletteOpenerDragLeave,
  onPaletteOpenerDrop,
  paletteOpenerTitle,
  activateWidgetFromPaletteChip,
  onPaletteOpenerClick,
  pinFromPaletteInArrangeMode,
} = useCallMenu(
  props,
  {
    disconnect: () => emit("disconnect"),
    activateCallWidget: (id) => emit("activateCallWidget", id),
  },
  menuRootRef,
);

const menuClass = toRef(props, "menuClass");
</script>

<style scoped>
.call-menu {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  width: 100%;
  box-sizing: border-box;
}

.call-menu--widgets-open {
  z-index: 10045;
}

.call-menu__bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.call-menu__start {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  justify-self: start;
}

.call-menu__bar :deep(.left),
.call-menu__bar :deep(.right),
.call-menu__bar :deep(.center) {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  min-width: 0;
}

.call-menu__bar :deep(.left) {
  justify-content: flex-start;
  flex: 0 0 auto;
  padding-right: 0;
}

.call-menu__bar :deep(.center) {
  justify-content: center;
  justify-self: center;
  padding-left: 8px;
  padding-right: 8px;
}

.call-menu__bar :deep(.right) {
  justify-content: flex-end;
  justify-self: end;
}

.call-menu__replica {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  max-width: 280px;
  padding: 14px 18px 14px 0;
  box-sizing: border-box;
}

.call-menu__replica :deep(.replica-input) {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-shrink: 1;
}

.call-menu__replica :deep(.replica-input__field) {
  flex: 1 1 auto;
  width: auto;
  min-width: 0;
}

.call-menu__widget-system {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: nowrap;
  justify-content: flex-end;
  align-self: center;
}

.call-menu__widget-system :deep(.button) {
  width: 48px;
  height: 48px;
  min-width: 48px;
  min-height: 48px;
}

.call-menu__pinned-scroll {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: min(82vw, 520px);
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.call-menu__pinned-scroll::-webkit-scrollbar {
  display: none;
}

.call-menu__widgets-overlay {
  position: fixed;
  inset: 0;
  z-index: 10040;
  pointer-events: none;
}

@media (max-width: 1270px) {
  .call-menu__bar--has-replica {
    row-gap: 8px;
    grid-template-areas:
      "start center right"
      "replica replica replica";
  }

  .call-menu__bar--has-replica .call-menu__start {
    display: contents;
  }

  .call-menu__bar--has-replica :deep(.left) {
    grid-area: start;
    padding-right: 18px;
  }

  .call-menu__bar--has-replica :deep(.center) {
    grid-area: center;
  }

  .call-menu__bar--has-replica :deep(.right) {
    grid-area: right;
  }

  .call-menu__bar--has-replica .call-menu__replica {
    grid-area: replica;
    flex: none;
    max-width: none;
    width: 100%;
    padding: 0 18px 14px;
  }
}

@media (max-width: 768px) {
  .call-menu {
    gap: 0;
    padding: 8px 6px;
    padding-bottom: max(8px, env(safe-area-inset-bottom, 0));
  }

  .call-menu__bar {
    column-gap: 4px;
    row-gap: 8px;
    grid-template-areas: "start center right";
  }

  .call-menu__bar--has-replica {
    grid-template-areas:
      "start center right"
      "replica replica replica";
  }

  .call-menu__start {
    display: contents;
  }

  .call-menu__bar :deep(.left) {
    grid-area: start;
    justify-content: flex-start;
    flex: none;
    padding: 0;
    gap: 6px;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }

  .call-menu__bar :deep(.left)::-webkit-scrollbar {
    display: none;
  }

  .call-menu__bar :deep(.center) {
    grid-area: center;
    padding: 0;
    gap: 6px;
  }

  .call-menu__bar :deep(.right) {
    grid-area: right;
    justify-content: flex-end;
    padding: 0;
    gap: 6px;
    overflow: visible;
  }

  .call-menu__replica {
    grid-area: replica;
    flex: none;
    max-width: none;
    width: 100%;
    padding: 0;
  }

  .call-menu__bar :deep(.button) {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    border-width: 3px;
    flex-shrink: 0;
  }

  .call-menu__replica :deep(.replica-input__field) {
    width: auto;
    height: 44px;
  }

  .call-menu__replica :deep(.replica-input__btn) {
    width: 44px !important;
    height: 44px !important;
    min-width: 44px !important;
    min-height: 44px !important;
  }

  .call-menu__widget-system {
    gap: 6px;
  }

  .call-menu__pinned-scroll {
    max-width: min(40vw, 160px);
    gap: 6px;
  }
}

@media (max-width: 480px) {
  .call-menu {
    padding: 6px 4px;
    padding-bottom: max(6px, env(safe-area-inset-bottom, 0));
  }

  .call-menu__bar {
    column-gap: 2px;
    row-gap: 6px;
  }

  .call-menu__bar :deep(.left),
  .call-menu__bar :deep(.right),
  .call-menu__bar :deep(.center) {
    gap: 4px;
  }

  .call-menu__bar :deep(.button) {
    width: 42px;
    height: 42px;
    min-width: 42px;
    min-height: 42px;
  }

  .call-menu__replica :deep(.replica-input__field) {
    height: 42px;
  }

  .call-menu__replica :deep(.replica-input__btn) {
    width: 42px !important;
    height: 42px !important;
    min-width: 42px !important;
    min-height: 42px !important;
  }

  .call-menu__pinned-scroll {
    max-width: min(34vw, 130px);
  }
}
</style>
