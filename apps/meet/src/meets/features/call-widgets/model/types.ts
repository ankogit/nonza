import type { PixelIconName } from "@shared/ui/PixelIcon";

export type CallWidgetId =
  | "document"
  | "whiteboard"
  | "soundbar"
  | "settings"
  | "table_chat"
  | "table_dice"
  | "table_stream";

export type RoomCallWidgetLayout = {
  maxSlots: number;
  defaultPinned: CallWidgetId[];
  paletteOrder: CallWidgetId[];
};

export const WIDGET_META: Record<
  CallWidgetId,
  { label: string; icon: PixelIconName }
> = {
  document: { label: "Документ", icon: "document" },
  whiteboard: { label: "Доска", icon: "edit" },
  soundbar: { label: "Звуки", icon: "notes" },
  settings: { label: "Настройки", icon: "settings" },
  table_chat: { label: "Чат стола", icon: "message" },
  table_dice: { label: "Кости", icon: "dice" },
  table_stream: { label: "Стрим", icon: "screen-on" },
};
