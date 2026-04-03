import { CALL_WIDGET_DND_TYPE } from "@features/call-widgets";
import type { CallWidgetId } from "@features/call-widgets";
import { pixelIconClass, type PixelIconName } from "@shared/ui";

export type CallWidgetDnDPayload = { id: CallWidgetId; fromSlot?: number };

const DND_FLOAT_CLASS = "call-menu__dnd-float";

export function writeCallWidgetDragData(
  dt: DataTransfer,
  payload: CallWidgetDnDPayload,
): void {
  const json = JSON.stringify(payload);
  dt.setData("text/plain", json);
  dt.setData(CALL_WIDGET_DND_TYPE, json);
  dt.effectAllowed = "move";
}

export function readCallWidgetDragPayload(
  ev: DragEvent,
): CallWidgetDnDPayload | null {
  const dt = ev.dataTransfer;
  if (!dt) return null;
  const raw = dt.getData(CALL_WIDGET_DND_TYPE) || dt.getData("text/plain");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CallWidgetDnDPayload;
  } catch {
    return null;
  }
}

export function dataTransferLooksLikeCallWidgetDrag(
  dt: DataTransfer | null,
): boolean {
  if (!dt) return false;
  const types = Array.from(dt.types);
  return (
    types.includes(CALL_WIDGET_DND_TYPE) ||
    types.some((x) => x.toLowerCase() === "text/plain")
  );
}

export function setCallWidgetDragPreview(
  ev: DragEvent,
  icon: PixelIconName,
): void {
  const target = ev.currentTarget;
  if (!(target instanceof HTMLElement)) return;
  const dt = ev.dataTransfer;
  if (!dt) return;

  const wrap = document.createElement("div");
  wrap.className = DND_FLOAT_CLASS;
  const inner = document.createElement("i");
  inner.className = `${pixelIconClass(icon)} pi--large`;
  inner.setAttribute("aria-hidden", "true");
  wrap.appendChild(inner);
  wrap.style.position = "fixed";
  wrap.style.left = "-9999px";
  wrap.style.top = "0";
  document.body.appendChild(wrap);

  const r = wrap.getBoundingClientRect();
  try {
    dt.setDragImage(wrap, Math.round(r.width / 2), Math.round(r.height / 2));
  } catch {
    wrap.remove();
    return;
  }

  target.addEventListener(
    "dragend",
    () => {
      wrap.remove();
    },
    { once: true },
  );
}

export function armCallWidgetDragEndCleanup(clear: () => void): void {
  document.addEventListener("dragend", clear, { once: true });
}

export function eventTargetElement(t: EventTarget | null): Element | null {
  if (t instanceof Element) return t;
  if (t instanceof Node && t.parentElement) return t.parentElement;
  return null;
}

export function targetIsInsideCallMenuPaletteDrawer(
  target: EventTarget | null,
): boolean {
  const el = eventTargetElement(target);
  if (!el) return false;
  return Boolean(el.closest(".call-menu-drawer"));
}
