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
      },
    ]"
  >
    <div class="left">
      <slot name="left" />
    </div>
    <div class="center">
      <slot name="center">
        <Button variant="danger" title="Закончить разговор" @click="emit('disconnect')">
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
    <Teleport to="body">
      <div v-if="showWidgetSystem && paletteOpen" class="call-menu__widgets-overlay">
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

const props = withDefaults(
  defineProps<CallMenuProps>(),
  {
    roomId: null,
    activeCallWidgetIds: () => [],
  },
);

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
} = useCallMenu(props, {
  disconnect: () => emit("disconnect"),
  activateCallWidget: (id) => emit("activateCallWidget", id),
}, menuRootRef);

const menuClass = toRef(props, "menuClass");
</script>

<style scoped>
.call-menu {
  position: relative;
}

.call-menu--widgets-open {
  z-index: 10045;
}

.call-menu__widget-system {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
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
  padding-bottom: 2px;
}

.call-menu__widgets-overlay {
  position: fixed;
  inset: 0;
  z-index: 10040;
  pointer-events: none;
}
</style>
