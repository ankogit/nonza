import { computed, ref, toRef, type Ref } from "vue";
import type { DisplayRoomType } from "@shared/lib";
import {
  WIDGET_META,
  useCallWidgetSlots,
  type CallWidgetId,
} from "@features/call-widgets";
import type { PixelIconName } from "@shared/ui";
import {
  armCallWidgetDragEndCleanup,
  dataTransferLooksLikeCallWidgetDrag,
  readCallWidgetDragPayload,
  setCallWidgetDragPreview,
  targetIsInsideCallMenuPaletteDrawer,
  writeCallWidgetDragData,
} from "./callWidgetDnD";

export type CallMenuProps = {
  menuClass?: string;
  displayRoomType: DisplayRoomType;
  roomId?: string | null;
  enabledWidgetIds: CallWidgetId[];
  storageSuffix?: string;
  activeCallWidgetIds?: CallWidgetId[];
};

export type CallMenuEmitFns = {
  disconnect: () => void;
  activateCallWidget: (id: CallWidgetId) => void;
};

export type PaletteEntry = {
  id: CallWidgetId;
  label: string;
  icon: PixelIconName;
};

export function useCallMenu(
  props: CallMenuProps,
  emit: CallMenuEmitFns,
  menuRootRef: Ref<HTMLElement | null>,
) {
  const {
    pinnedRow,
    paletteIds,
    maxSlots,
    placeAtSlot,
    pinFromPaletteFirstEmpty,
    unpinAt,
    moveSlot,
  } = useCallWidgetSlots(
    toRef(props, "displayRoomType"),
    toRef(props, "roomId"),
    toRef(props, "enabledWidgetIds"),
    { storageSuffix: toRef(props, "storageSuffix") },
  );

  const showWidgetSystem = computed(
    () => props.enabledWidgetIds.length > 0 && maxSlots.value > 0,
  );

  const paletteOpen = ref(false);
  const paletteArrangeMode = ref(false);
  const slotDropHighlightIndex = ref<number | null>(null);
  const paletteOpenerUnpinHover = ref(false);

  const visibleSlotItems = computed(() => {
    const row = pinnedRow.value;
    const arrange = paletteArrangeMode.value;
    const out: { index: number; slotId: CallWidgetId | null }[] = [];
    for (let i = 0; i < row.length; i++) {
      const id = row[i] ?? null;
      if (!arrange && id == null) continue;
      out.push({ index: i, slotId: id });
    }
    return out;
  });

  const paletteEntries = computed<PaletteEntry[]>(() =>
    paletteIds.value.map((id) => {
      const m = WIDGET_META[id];
      return {
        id,
        label: m.label,
        icon: m.icon as PixelIconName,
      };
    }),
  );

  function widgetSlotName(id: CallWidgetId): string {
    return `widget-${id}`;
  }

  function labelFor(id: CallWidgetId): string {
    return WIDGET_META[id].label;
  }

  function clearDragUi(): void {
    slotDropHighlightIndex.value = null;
    paletteOpenerUnpinHover.value = false;
  }

  function armDragCleanup(): void {
    armCallWidgetDragEndCleanup(clearDragUi);
  }

  function onDragFromPalette(ev: DragEvent, id: CallWidgetId): void {
    const dt = ev.dataTransfer;
    if (!dt) return;
    writeCallWidgetDragData(dt, { id });
    armDragCleanup();
    setCallWidgetDragPreview(ev, WIDGET_META[id].icon as PixelIconName);
  }

  function onDragFromSlot(
    ev: DragEvent,
    id: CallWidgetId,
    index: number,
  ): void {
    const dt = ev.dataTransfer;
    if (!dt) return;
    writeCallWidgetDragData(dt, { id, fromSlot: index });
    armDragCleanup();
    setCallWidgetDragPreview(ev, WIDGET_META[id].icon as PixelIconName);
  }

  function onSlotDragOver(ev: DragEvent, index: number): void {
    ev.preventDefault();
    paletteOpenerUnpinHover.value = false;
    const ok = dataTransferLooksLikeCallWidgetDrag(ev.dataTransfer);
    slotDropHighlightIndex.value = ok ? index : null;
    try {
      if (ev.dataTransfer) {
        ev.dataTransfer.dropEffect = ok ? "move" : "none";
      }
    } catch {
      /* ignore */
    }
  }

  function onDropOnSlot(ev: DragEvent, index: number): void {
    ev.preventDefault();
    ev.stopPropagation();
    clearDragUi();
    const p = readCallWidgetDragPayload(ev);
    if (!p) return;
    if (p.fromSlot !== undefined) {
      moveSlot(p.fromSlot, index);
    } else {
      placeAtSlot(p.id, index);
    }
  }

  function onSlotGripDblClick(
    index: number,
    slotId: CallWidgetId | null,
  ): void {
    if (!paletteArrangeMode.value || slotId == null) return;
    unpinAt(index);
  }

  function onPaletteDragOver(ev: DragEvent): void {
    ev.preventDefault();
    slotDropHighlightIndex.value = null;
    paletteOpenerUnpinHover.value = false;
    try {
      if (ev.dataTransfer) {
        const overDrawer = targetIsInsideCallMenuPaletteDrawer(ev.target);
        const ok =
          overDrawer && dataTransferLooksLikeCallWidgetDrag(ev.dataTransfer);
        ev.dataTransfer.dropEffect = ok ? "move" : "none";
      }
    } catch {
      /* ignore */
    }
  }

  function onPaletteDrop(ev: DragEvent): void {
    ev.preventDefault();
    clearDragUi();
    if (!targetIsInsideCallMenuPaletteDrawer(ev.target)) return;
    const p = readCallWidgetDragPayload(ev);
    if (!p || p.fromSlot === undefined) return;
    unpinAt(p.fromSlot);
  }

  function onPaletteOpenerDragOver(ev: DragEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    slotDropHighlightIndex.value = null;
    const ok = dataTransferLooksLikeCallWidgetDrag(ev.dataTransfer);
    paletteOpenerUnpinHover.value = ok;
    try {
      if (ev.dataTransfer) {
        ev.dataTransfer.dropEffect = ok ? "move" : "none";
      }
    } catch {
      /* ignore */
    }
  }

  function onPaletteOpenerDragLeave(ev: DragEvent): void {
    const cur = ev.currentTarget;
    if (!(cur instanceof HTMLElement)) return;
    const rel = ev.relatedTarget;
    if (rel instanceof Node && cur.contains(rel)) return;
    paletteOpenerUnpinHover.value = false;
  }

  function onPaletteOpenerDrop(ev: DragEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    clearDragUi();
    const p = readCallWidgetDragPayload(ev);
    if (!p || p.fromSlot === undefined) return;
    unpinAt(p.fromSlot);
  }

  const paletteOpenerTitle = computed(() => {
    if (paletteArrangeMode.value || paletteIds.value.length > 0) {
      return "Виджеты";
    }
    const pinnedCount = pinnedRow.value.filter((id) => id != null).length;
    if (pinnedCount === 1) return "Виджет на панели";
    return "Виджеты";
  });

  function clickFirstPinnedWidgetControl(): void {
    const root = menuRootRef.value;
    if (!root) return;
    const btn = root.querySelector(
      ".call-menu-slot:not(.call-menu-slot--empty) .call-menu-slot__body button",
    );
    if (btn instanceof HTMLElement) btn.click();
  }

  function activateWidgetFromPaletteChip(id: CallWidgetId): void {
    if (paletteArrangeMode.value) return;
    emit.activateCallWidget(id);
  }

  function onPaletteOpenerClick(): void {
    if (paletteArrangeMode.value) {
      paletteOpen.value = !paletteOpen.value;
      return;
    }
    if (paletteOpen.value) {
      paletteOpen.value = false;
      return;
    }
    if (paletteIds.value.length > 0) {
      paletteOpen.value = true;
      return;
    }
    const pinned = pinnedRow.value.filter((id): id is CallWidgetId => id != null);
    if (pinned.length === 1) {
      clickFirstPinnedWidgetControl();
      return;
    }
    paletteOpen.value = true;
  }

  function pinFromPaletteInArrangeMode(id: CallWidgetId): void {
    pinFromPaletteFirstEmpty(id);
  }

  return {
    pinnedRow,
    paletteIds,
    maxSlots,
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
  };
}
