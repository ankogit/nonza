import { computed, ref, watch, unref } from "vue";
import type { Ref } from "vue";
import type { DisplayRoomType } from "@shared/lib";
import type { CallWidgetId } from "../model/types";
import {
  ROOM_CALL_WIDGET_LAYOUTS,
  orderedPaletteIds,
} from "../model/roomWidgetLayouts";

function storageKey(
  roomType: DisplayRoomType | null | undefined,
  roomId: string | null | undefined,
  storageSuffix: string | undefined,
): string {
  const r = (roomId ?? "guest").trim() || "guest";
  const t = roomType ?? "unknown";
  const s = storageSuffix ? `:${storageSuffix}` : "";
  return `nonza:call-widgets:${t}:${r}${s}`;
}

function parsePinned(raw: unknown, max: number): (CallWidgetId | null)[] {
  if (!Array.isArray(raw)) return [];
  const row = raw.filter(
    (x): x is CallWidgetId | null => x === null || typeof x === "string",
  ) as (CallWidgetId | null)[];
  return row.slice(0, max);
}

export function useCallWidgetSlots(
  roomType: Ref<DisplayRoomType | null | undefined>,
  roomId: Ref<string | null | undefined>,
  enabledIds: Ref<CallWidgetId[]>,
  options?: { storageSuffix?: Ref<string | undefined> },
) {
  const storageSuffixRef = options?.storageSuffix;

  const layout = computed(() => {
    const t = roomType.value;
    return t ? ROOM_CALL_WIDGET_LAYOUTS[t] : null;
  });

  const enabledSet = computed(() => new Set(enabledIds.value));

  const maxSlots = computed(() => layout.value?.maxSlots ?? 0);

  const pinnedRow = ref<(CallWidgetId | null)[]>([]);

  function sanitizeRow(
    row: (CallWidgetId | null)[],
  ): (CallWidgetId | null)[] {
    const max = maxSlots.value;
    if (!max) return [];
    const en = enabledSet.value;
    const used = new Set<CallWidgetId>();
    const out: (CallWidgetId | null)[] = [];
    for (let i = 0; i < max; i++) {
      const v = row[i] ?? null;
      if (v == null || !en.has(v) || used.has(v)) {
        out.push(null);
      } else {
        used.add(v);
        out.push(v);
      }
    }
    return out;
  }

  function defaultRow(): (CallWidgetId | null)[] {
    const max = maxSlots.value;
    if (!max) return [];
    const en = enabledSet.value;
    const def = layout.value?.defaultPinned ?? [];
    const row: (CallWidgetId | null)[] = Array.from(
      { length: max },
      () => null,
    );
    let i = 0;
    for (const id of def) {
      if (i >= max) break;
      if (en.has(id)) {
        row[i] = id;
        i++;
      }
    }
    return sanitizeRow(row);
  }

  function loadFromStorage(): void {
    const max = maxSlots.value;
    if (!max || !layout.value) {
      pinnedRow.value = [];
      return;
    }
    if (enabledIds.value.length === 0) {
      pinnedRow.value = Array.from({ length: max }, () => null);
      return;
    }
    const key = storageKey(
      roomType.value,
      roomId.value,
      storageSuffixRef ? unref(storageSuffixRef) : undefined,
    );
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        pinnedRow.value = sanitizeRow(parsePinned(parsed, max));
        if (pinnedRow.value.every((c) => c === null)) {
          pinnedRow.value = defaultRow();
        }
        return;
      }
    } catch {
      /* default */
    }
    pinnedRow.value = defaultRow();
  }

  function persist(): void {
    const max = maxSlots.value;
    if (!max || !layout.value) return;
    if (enabledIds.value.length === 0) return;
    const key = storageKey(
      roomType.value,
      roomId.value,
      storageSuffixRef ? unref(storageSuffixRef) : undefined,
    );
    try {
      localStorage.setItem(key, JSON.stringify(pinnedRow.value));
    } catch {
      /* quota */
    }
  }

  watch(
    [
      roomType,
      roomId,
      enabledIds,
      maxSlots,
      layout,
      () => (storageSuffixRef ? unref(storageSuffixRef) : undefined),
    ],
    () => {
      loadFromStorage();
    },
    { immediate: true, deep: true },
  );

  watch(
    pinnedRow,
    () => {
      persist();
    },
    { deep: true },
  );

  const pinnedIds = computed(() =>
    pinnedRow.value.filter((x): x is CallWidgetId => x != null),
  );

  const paletteIds = computed(() => {
    const lay = layout.value;
    if (!lay || enabledIds.value.length === 0) return [];
    const order = orderedPaletteIds(lay, enabledSet.value);
    const pin = new Set(
      pinnedRow.value.filter((x): x is CallWidgetId => x != null),
    );
    return order.filter((id) => !pin.has(id));
  });

  function placeAtSlot(id: CallWidgetId, slotIndex: number): void {
    const max = maxSlots.value;
    if (!max || !enabledSet.value.has(id)) return;
    const next = [...pinnedRow.value];
    while (next.length < max) next.push(null);
    const prevIdx = next.indexOf(id);
    if (prevIdx >= 0) next[prevIdx] = null;
    if (slotIndex >= 0 && slotIndex < max) {
      const displaced = next[slotIndex];
      next[slotIndex] = id;
      if (displaced && displaced !== id) {
        const empty = next.findIndex((c, i) => c === null && i !== slotIndex);
        if (empty >= 0) next[empty] = displaced;
        else {
          const other = next.findIndex((c) => c === null);
          if (other >= 0) next[other] = displaced;
        }
      }
    }
    pinnedRow.value = sanitizeRow(next);
  }

  function pinFromPaletteFirstEmpty(id: CallWidgetId): void {
    const max = maxSlots.value;
    if (!max || !enabledSet.value.has(id)) return;
    const next = [...pinnedRow.value];
    while (next.length < max) next.push(null);
    if (next.includes(id)) return;
    const empty = next.findIndex((c) => c === null);
    if (empty >= 0) {
      next[empty] = id;
      pinnedRow.value = sanitizeRow(next);
    }
  }

  function unpinAt(slotIndex: number): void {
    if (slotIndex < 0 || slotIndex >= pinnedRow.value.length) return;
    const next = [...pinnedRow.value];
    next[slotIndex] = null;
    pinnedRow.value = sanitizeRow(next);
  }

  function moveSlot(fromIndex: number, toIndex: number): void {
    const max = maxSlots.value;
    if (!max || fromIndex === toIndex) return;
    const next = [...pinnedRow.value];
    while (next.length < max) next.push(null);
    const a = next[fromIndex];
    const b = next[toIndex];
    next[fromIndex] = b ?? null;
    next[toIndex] = a ?? null;
    pinnedRow.value = sanitizeRow(next);
  }

  return {
    pinnedRow,
    pinnedIds,
    paletteIds,
    maxSlots,
    layout,
    placeAtSlot,
    pinFromPaletteFirstEmpty,
    unpinAt,
    moveSlot,
  };
}
