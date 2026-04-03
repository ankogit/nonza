import type { DisplayRoomType } from "@shared/lib";
import type { CallWidgetId, RoomCallWidgetLayout } from "./types";

export const STANDARD_CALL_WIDGET_PALETTE_ORDER: CallWidgetId[] = [
  "document",
  "whiteboard",
  "table_chat",
  "table_dice",
  "table_stream",
  "soundbar",
  "settings",
];

export const ROOM_CALL_WIDGET_LAYOUTS: Record<
  DisplayRoomType,
  RoomCallWidgetLayout
> = {
  round_table: {
    maxSlots: 3,
    defaultPinned: [],
    paletteOrder: [...STANDARD_CALL_WIDGET_PALETTE_ORDER],
  },
  conference_hall: {
    maxSlots: 3,
    defaultPinned: [],
    paletteOrder: [...STANDARD_CALL_WIDGET_PALETTE_ORDER],
  },
  table_circle: {
    maxSlots: 3,
    defaultPinned: [],
    paletteOrder: [...STANDARD_CALL_WIDGET_PALETTE_ORDER],
  },
};

export function orderedPaletteIds(
  layout: RoomCallWidgetLayout,
  enabled: Set<CallWidgetId>,
): CallWidgetId[] {
  const out: CallWidgetId[] = [];
  for (const id of layout.paletteOrder) {
    if (enabled.has(id)) out.push(id);
  }
  for (const id of enabled) {
    if (!out.includes(id)) out.push(id);
  }
  return out;
}
