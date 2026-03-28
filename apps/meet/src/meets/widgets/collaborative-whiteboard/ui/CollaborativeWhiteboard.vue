<template>
  <div
    class="collab-whiteboard"
    :class="{ 'collab-whiteboard--embedded': embedded }"
  >
    <div v-if="!embedded" class="collab-whiteboard__header">
      <h3 class="collab-whiteboard__title">Совместная доска</h3>
      <div class="collab-whiteboard__actions">
        <Button
          type="icon"
          size="small"
          variant="default"
          class="collab-whiteboard__button"
          title="Сохранить как JPG"
          aria-label="Сохранить как JPG"
          @click="exportToJpg"
        >
          <PixelIcon name="download" variant="small" />
        </Button>
        <Button
          type="icon"
          size="small"
          variant="danger"
          class="collab-whiteboard__button"
          title="Очистить доску"
          aria-label="Очистить доску"
          @click="showClearConfirm = true"
        >
          <PixelIcon name="delete" variant="small" />
        </Button>
        <div
          v-if="connectionStatus !== 'connected'"
          class="collab-whiteboard__status"
          role="status"
          :aria-label="
            connectionStatus === 'connecting' ? 'Подключение' : 'Отключено'
          "
          :class="{
            'collab-whiteboard__status--connecting':
              connectionStatus === 'connecting',
            'collab-whiteboard__status--disconnected':
              connectionStatus === 'disconnected',
          }"
        >
          <template v-if="connectionStatus === 'connecting'">
            Подключение...
          </template>
          <PixelIcon v-else name="loading" variant="small" />
        </div>
      </div>
    </div>

    <div class="collab-whiteboard__toolbar" aria-label="Инструменты доски">
      <div class="collab-whiteboard__toolbar-row">
        <ParticipantColorPalette
          v-model="brushColor"
          v-model:expanded="colorPanelOpen"
          :palette="colorPalette"
          :eraser="isEraser"
          swatch-title="Цвет линии"
          swatch-aria-label="Развернуть палитру"
          native-picker-aria-label="Выбор цвета"
          @pick="isEraser = false"
        />
        <div
          class="collab-whiteboard__sizes"
          role="group"
          aria-label="Толщина линии"
        >
          <Button
            v-for="p in widthPresets"
            :key="p.id"
            type="text"
            size="tiny"
            :variant="activeWidthId === p.id ? 'active' : 'default'"
            :title="p.title"
            @click="activeWidthId = p.id"
          >
            {{ p.label }}
          </Button>
        </div>
        <Button
          type="icon"
          size="tiny"
          :variant="isEraser ? 'active' : 'default'"
          class="collab-whiteboard__button"
          title="Ластик"
          aria-label="Ластик"
          :aria-pressed="isEraser"
          @click="isEraser = !isEraser"
        >
          <img
            src="/icons/eraser.png"
            alt=""
            width="15"
            height="15"
            class="collab-whiteboard__eraser-icon"
            decoding="async"
          />
        </Button>
        <Button
          type="icon"
          size="tiny"
          variant="default"
          class="collab-whiteboard__button"
          title="Отменить последнее действие"
          aria-label="Отменить последнее действие"
          :disabled="!canUndoWhiteboard"
          @click="undoWhiteboard"
        >
          <PixelIcon name="undo" variant="small" />
        </Button>
        <Button
          type="icon"
          size="tiny"
          variant="default"
          class="collab-whiteboard__button"
          title="Вернуть отменённое"
          aria-label="Вернуть отменённое"
          :disabled="!canRedoWhiteboard"
          @click="redoWhiteboard"
        >
          <PixelIcon name="redo" variant="small" />
        </Button>
        <div v-if="embedded" class="collab-whiteboard__toolbar-tail">
          <Button
            type="icon"
            size="tiny"
            variant="default"
            class="collab-whiteboard__button"
            title="Сохранить как JPG"
            aria-label="Сохранить как JPG"
            @click="exportToJpg"
          >
            <PixelIcon name="download" variant="small" />
          </Button>
          <Button
            type="icon"
            size="tiny"
            variant="danger"
            class="collab-whiteboard__button"
            title="Очистить доску"
            aria-label="Очистить доску"
            @click="showClearConfirm = true"
          >
            <PixelIcon name="delete" variant="small" />
          </Button>
        </div>
      </div>
    </div>

    <div
      class="collab-whiteboard__surface-slot"
      :class="{ 'collab-whiteboard__surface-slot--embedded': embedded }"
    >
      <div
        ref="surfaceRef"
        class="collab-whiteboard__surface"
        :class="{ 'collab-whiteboard__surface--eraser': isEraser }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @pointerleave="onPointerLeave"
        @pointerrawupdate="onPointerRawUpdate"
        @contextmenu.prevent
      >
        <canvas ref="canvasRef" class="collab-whiteboard__canvas" />
        <div class="collab-whiteboard__cursors">
          <div
            v-if="localCursor"
            class="collab-whiteboard__cursor"
            :class="{ 'collab-whiteboard__cursor--eraser': localCursor.erase }"
            :style="{
              transform: `translate(${localCursor.x}px, ${localCursor.y}px) translate(-50%, -50%)`,
              '--cursor-size': `${localCursor.sizePx}px`,
              '--cursor-border': `${localCursor.borderWidthPx}px`,
              borderColor: localCursor.erase ? '#e0e0e0' : localCursor.color,
            }"
          />
          <div
            v-for="p in remoteCursors"
            :key="p.clientId"
            class="collab-whiteboard__cursor"
            :class="{ 'collab-whiteboard__cursor--eraser': p.erase }"
            :style="{
              transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`,
              '--cursor-size': `${p.sizePx}px`,
              '--cursor-border': `${p.borderWidthPx}px`,
              borderColor: p.erase ? '#e0e0e0' : p.color,
            }"
          >
            <span
              class="collab-whiteboard__cursor-label"
              :style="{ background: p.erase ? '#9e9e9e' : p.color }"
              >{{ p.name }}{{ p.erase ? " — ластик" : "" }}</span
            >
          </div>
        </div>
      </div>
    </div>

    <Modal
      :model-value="showClearConfirm"
      title="Очистить доску?"
      @update:model-value="showClearConfirm = $event"
    >
      <p class="collab-whiteboard__confirm-text">
        Все штрихи на доске будут удалены для всех участников. Это действие
        нельзя отменить.
      </p>
      <template #footer>
        <Button
          type="text"
          variant="danger"
          size="small"
          @click="confirmClearAll"
        >
          Очистить
        </Button>
        <Button
          type="text"
          variant="secondary"
          size="small"
          @click="showClearConfirm = false"
        >
          Отмена
        </Button>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  shallowRef,
  computed,
  inject,
  watch,
  onMounted,
  onBeforeUnmount,
} from "vue";
import * as Y from "yjs";
import { Button, Modal, PixelIcon, ParticipantColorPalette } from "@shared/ui";
import { PARTICIPANT_COLOR_PALETTE } from "@shared/lib";
import { MEET_ROOM_COLLABORATION_KEY } from "@features/room-collaboration";
import {
  WHITEBOARD_YARRAY_KEY,
  WHITEBOARD_MAX_STROKES,
} from "../model/constants";
import type { WhiteboardAwarenessPayload } from "../model/types";

const props = defineProps<{
  participantColor: string;
  embedded?: boolean;
  roomId?: string | null;
}>();

const WB_ROOM_BRUSH_COLOR_PREFIX = "nonza_meet_wb_brush_color_";

function readStoredBrushColor(roomId: string): string | null {
  try {
    const v = localStorage.getItem(WB_ROOM_BRUSH_COLOR_PREFIX + roomId);
    if (typeof v !== "string" || v.trim() === "") return null;
    return v.trim();
  } catch {
    return null;
  }
}

function writeStoredBrushColor(roomId: string | undefined, color: string) {
  if (!roomId) return;
  try {
    localStorage.setItem(WB_ROOM_BRUSH_COLOR_PREFIX + roomId, color);
  } catch {
    /* ignore */
  }
}

function isLikelyHexColor(s: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s.trim());
}

const collab = inject(MEET_ROOM_COLLABORATION_KEY, null);

const widthPresets = [
  { id: "s", label: "S", n: 0.004, title: "Тонкая" },
  { id: "m", label: "M", n: 0.01, title: "Средняя" },
  { id: "l", label: "L", n: 0.03, title: "Толстая" },
] as const;

const activeWidthId = ref<(typeof widthPresets)[number]["id"]>("m");
const brushWidthNorm = computed(() => {
  const p = widthPresets.find((x) => x.id === activeWidthId.value);
  return p?.n ?? 0.0065;
});

const colorPalette = [...PARTICIPANT_COLOR_PALETTE];
const brushColor = ref(props.participantColor);
const isEraser = ref(false);
const colorPanelOpen = ref(false);
const showClearConfirm = ref(false);

watch(
  () => props.roomId,
  (id) => {
    if (id) {
      const stored = readStoredBrushColor(id);
      if (stored && isLikelyHexColor(stored)) {
        brushColor.value = stored;
        return;
      }
    }
    const c = props.participantColor;
    if (typeof c === "string" && c.trim() !== "") {
      brushColor.value = c.trim();
    }
  },
  { immediate: true },
);

watch(
  () => props.participantColor,
  (c) => {
    if (props.roomId) return;
    if (typeof c === "string" && c.trim() !== "") {
      brushColor.value = c.trim();
    }
  },
);

watch(brushColor, (c) => {
  if (props.roomId && isLikelyHexColor(c)) {
    writeStoredBrushColor(props.roomId, c);
  }
});

const connectionStatus = computed(() => {
  if (!collab) return "disconnected" as const;
  return collab.connectionStatus.value;
});

const WB_PERSIST_DEBOUNCE_MS = 1800;
let persistRoomTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersistRoom() {
  if (persistRoomTimer !== null) {
    window.clearTimeout(persistRoomTimer);
  }
  persistRoomTimer = window.setTimeout(() => {
    persistRoomTimer = null;
    collab?.persistRoomDocumentInBackground?.();
  }, WB_PERSIST_DEBOUNCE_MS);
}

function flushPersistRoomNow() {
  if (persistRoomTimer !== null) {
    window.clearTimeout(persistRoomTimer);
    persistRoomTimer = null;
  }
  collab?.persistRoomDocument?.();
}

const surfaceRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

const strokesArray = shallowRef<Y.Array<Y.Map<unknown>> | null>(null);

let whiteboardUndoManager: Y.UndoManager | null = null;
const canUndoWhiteboard = ref(false);
const canRedoWhiteboard = ref(false);

function syncWhiteboardUndoUi() {
  const um = whiteboardUndoManager;
  canUndoWhiteboard.value = um ? um.canUndo() : false;
  canRedoWhiteboard.value = um ? um.canRedo() : false;
}

function undoWhiteboard() {
  whiteboardUndoManager?.undo();
}

function redoWhiteboard() {
  whiteboardUndoManager?.redo();
}

const isDrawing = ref(false);
let activeDrawingPointerId = -1;
const localDraftPts: [number, number][] = [];

const usePointerRawUpdate =
  typeof window !== "undefined" &&
  typeof PointerEvent !== "undefined" &&
  "onpointerrawupdate" in window &&
  !/firefox/i.test(navigator.userAgent);

let rafAwareness = 0;
let pendingAwareness: WhiteboardAwarenessPayload | null = null;

const remoteCursors = ref<
  Array<{
    clientId: number;
    x: number;
    y: number;
    color: string;
    name: string;
    erase: boolean;
    sizePx: number;
    borderWidthPx: number;
  }>
>([]);

const localCursorPos = ref<{ nx: number; ny: number } | null>(null);
const localCursor = ref<{
  x: number;
  y: number;
  color: string;
  erase: boolean;
  sizePx: number;
  borderWidthPx: number;
} | null>(null);

type StrokeSnapshot = {
  pts: [number, number][];
  color: string;
  width: number;
  erase: boolean;
};

function isDotLikeStroke(pts: [number, number][]): boolean {
  if (pts.length === 1) return true;
  if (pts.length === 2) {
    const [a, b] = pts;
    return a[0] === b[0] && a[1] === b[1];
  }
  return false;
}

let strokesSnapshotsCache: StrokeSnapshot[] = [];
let strokesSnapshotsDirty = true;

let surfaceW = 0;
let surfaceH = 0;

function computeCursorPx(sizeNorm: number, minDim: number) {
  // Ensure the cursor stays visible even for the thinnest brush.
  const sizePx = Math.max(8, Math.round(sizeNorm * minDim));
  const borderWidthPx = Math.max(2, Math.round(sizePx / 6));
  return { sizePx, borderWidthPx };
}

function updateLocalCursor() {
  const surface = surfaceRef.value;
  if (!surface) return;
  if (!localCursorPos.value) {
    localCursor.value = null;
    return;
  }

  let { w, h } = getSurfaceSize();
  if (w < 1 || h < 1) {
    refreshSurfaceMetrics();
    const m = getSurfaceSize();
    if (m.w < 1 || m.h < 1) return;
    w = m.w;
    h = m.h;
  }
  const minDim = Math.min(w, h);
  const { nx, ny } = localCursorPos.value;
  const widthNorm = brushWidthNorm.value;
  const { sizePx, borderWidthPx } = computeCursorPx(widthNorm, minDim);

  localCursor.value = {
    x: nx * w,
    y: ny * h,
    color: brushColor.value,
    erase: isEraser.value,
    sizePx,
    borderWidthPx,
  };
}

function getSurfaceSize() {
  return { w: surfaceW, h: surfaceH };
}

function refreshSurfaceMetrics() {
  const el = surfaceRef.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  surfaceW = r.width;
  surfaceH = r.height;
}

function scheduleAwareness(payload: WhiteboardAwarenessPayload) {
  pendingAwareness = payload;
  if (rafAwareness) return;
  rafAwareness = requestAnimationFrame(() => {
    rafAwareness = 0;
    const aw = collab?.awareness.value;
    const p = pendingAwareness;
    pendingAwareness = null;
    if (aw && p) {
      aw.setLocalStateField("whiteboard", p);
    }
  });
}

function clearWhiteboardAwareness() {
  const aw = collab?.awareness.value;
  if (!aw) return;
  const s = aw.getLocalState();
  if (!s || !Object.prototype.hasOwnProperty.call(s, "whiteboard")) return;
  const next = { ...s } as Record<string, unknown>;
  delete next.whiteboard;
  aw.setLocalState(next as typeof s);
}

function snapshotStrokes(arr: Y.Array<Y.Map<unknown>>) {
  const out: StrokeSnapshot[] = [];
  for (let i = 0; i < arr.length; i++) {
    const m = arr.get(i);
    if (!(m instanceof Y.Map)) continue;
    const id = m.get("id");
    const ptsJson = m.get("pts");
    const color = m.get("color");
    const width = m.get("width");
    const erase = m.get("erase");
    if (typeof id !== "string" || typeof ptsJson !== "string") continue;
    try {
      const pts = JSON.parse(ptsJson) as [number, number][];
      if (!Array.isArray(pts) || pts.length < 1) continue;
      out.push({
        pts,
        color: typeof color === "string" ? color : "#bab1a8",
        width: typeof width === "number" ? width : 0.004,
        erase: erase === true,
      });
    } catch {
      /* skip */
    }
  }
  return out;
}

function paintCanvas() {
  const canvas = canvasRef.value;
  const surface = surfaceRef.value;
  if (!canvas || !surface) return;

  let { w, h } = getSurfaceSize();
  if (w < 1 || h < 1) {
    refreshSurfaceMetrics();
    ({ w, h } = getSurfaceSize());
  }
  if (w < 1 || h < 1) return;

  const dpr = window.devicePixelRatio || 1;
  const targetW = Math.max(1, Math.floor(w * dpr));
  const targetH = Math.max(1, Math.floor(h * dpr));
  const sizeChanged = canvas.width !== targetW || canvas.height !== targetH;
  if (sizeChanged) {
    canvas.width = targetW;
    canvas.height = targetH;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const arr = strokesArray.value;
  if (arr) {
    if (strokesSnapshotsDirty) {
      strokesSnapshotsCache = snapshotStrokes(arr);
      strokesSnapshotsDirty = false;
    }
    const snapshots = strokesSnapshotsCache;
    const minDim = Math.min(w, h);
    for (const s of snapshots) {
      ctx.lineWidth = Math.max(1, s.width * minDim);
      if (isDotLikeStroke(s.pts)) {
        const [fx, fy] = s.pts[0];
        const px = fx * w;
        const py = fy * h;
        const r = Math.max(0.5, ctx.lineWidth / 2);
        ctx.save();
        if (s.erase) {
          ctx.globalCompositeOperation = "destination-out";
          ctx.fillStyle = "#000";
        } else {
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = s.color;
        }
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        const [fx, fy] = s.pts[0];
        ctx.moveTo(fx * w, fy * h);
        for (let i = 1; i < s.pts.length; i++) {
          const [nx, ny] = s.pts[i];
          ctx.lineTo(nx * w, ny * h);
        }
        if (s.erase) {
          ctx.save();
          ctx.globalCompositeOperation = "destination-out";
          ctx.strokeStyle = "#000";
          ctx.stroke();
          ctx.restore();
        } else {
          ctx.strokeStyle = s.color;
          ctx.stroke();
        }
      }
    }
  }

  if (localDraftPts.length >= 1) {
    const minDim = Math.min(w, h);
    ctx.lineWidth = Math.max(1, brushWidthNorm.value * minDim);
    if (localDraftPts.length === 1) {
      const [fx, fy] = localDraftPts[0];
      const px = fx * w;
      const py = fy * h;
      const r = Math.max(0.5, ctx.lineWidth / 2);
      ctx.save();
      if (isEraser.value) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "#000";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = brushColor.value;
      }
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();
      const [fx, fy] = localDraftPts[0];
      ctx.moveTo(fx * w, fy * h);
      for (let i = 1; i < localDraftPts.length; i++) {
        const [nx, ny] = localDraftPts[i];
        ctx.lineTo(nx * w, ny * h);
      }
      if (isEraser.value) {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "#000";
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = brushColor.value;
        ctx.stroke();
      }
    }
  }
}

let paintRaf = 0;
function requestPaint() {
  if (paintRaf) return;
  paintRaf = requestAnimationFrame(() => {
    paintRaf = 0;
    paintCanvas();
  });
}

function onStrokesChanged() {
  strokesSnapshotsDirty = true;
  requestPaint();
}

function bindStrokes(doc: Y.Doc | null) {
  const prev = strokesArray.value;
  if (prev) {
    prev.unobserve(onStrokesChanged);
  }
  if (whiteboardUndoManager) {
    whiteboardUndoManager.destroy();
    whiteboardUndoManager = null;
  }
  syncWhiteboardUndoUi();
  strokesArray.value = null;
  strokesSnapshotsCache = [];
  strokesSnapshotsDirty = true;
  if (!doc) {
    requestPaint();
    return;
  }
  const arr = doc.getArray<Y.Map<unknown>>(WHITEBOARD_YARRAY_KEY);
  strokesArray.value = arr;
  arr.observe(onStrokesChanged);
  whiteboardUndoManager = new Y.UndoManager(arr);
  for (const ev of [
    "stack-item-added",
    "stack-item-popped",
    "stack-cleared",
    "stack-item-updated",
  ] as const) {
    whiteboardUndoManager.on(ev, syncWhiteboardUndoUi);
  }
  syncWhiteboardUndoUi();
  requestPaint();
}

function updateRemoteCursors() {
  const aw = collab?.awareness.value;
  const surface = surfaceRef.value;
  if (!aw || !surface) {
    remoteCursors.value = [];
    return;
  }
  let { w, h } = getSurfaceSize();
  if (w < 1 || h < 1) {
    refreshSurfaceMetrics();
    ({ w, h } = getSurfaceSize());
  }
  const minDim = Math.min(w, h);
  const list: (typeof remoteCursors.value)[number][] = [];
  aw.getStates().forEach((state, clientId) => {
    if (clientId === aw.clientID) return;
    const wb = state.whiteboard as WhiteboardAwarenessPayload | undefined;
    const user = state.user as { name?: string; color?: string } | undefined;
    if (!wb || !user?.name) return;
    const erase = wb.erase === true;
    const widthNorm = typeof wb.width === "number" ? wb.width : 0.02;
    const sizePx = Math.max(8, Math.round(widthNorm * minDim));
    const borderWidthPx = Math.max(2, Math.round(sizePx / 6));
    list.push({
      clientId,
      x: wb.nx * w,
      y: wb.ny * h,
      color: typeof wb.color === "string" ? wb.color : (user.color ?? "#888"),
      name: user.name,
      erase,
      sizePx,
      borderWidthPx,
    });
  });
  remoteCursors.value = list;
}

let ro: ResizeObserver | null = null;

function normFromEvent(ev: PointerEvent) {
  const surface = surfaceRef.value;
  if (!surface) return { nx: 0, ny: 0 };
  const r = surface.getBoundingClientRect();
  const x = ev.clientX - r.left;
  const y = ev.clientY - r.top;
  const nx = r.width > 0 ? Math.min(1, Math.max(0, x / r.width)) : 0;
  const ny = r.height > 0 ? Math.min(1, Math.max(0, y / r.height)) : 0;
  return { nx, ny };
}

function pushDistinctDraftPoint(ev: PointerEvent): { nx: number; ny: number } {
  const { nx, ny } = normFromEvent(ev);
  const last = localDraftPts[localDraftPts.length - 1];
  if (!last || last[0] !== nx || last[1] !== ny) {
    localDraftPts.push([nx, ny]);
  }
  return { nx, ny };
}

function scheduleDrawingAwareness(nx: number, ny: number) {
  scheduleAwareness({
    phase: "drawing",
    nx,
    ny,
    width: brushWidthNorm.value,
    erase: isEraser.value,
    color: brushColor.value,
  });
}

function onPointerRawUpdate(ev: PointerEvent) {
  if (!usePointerRawUpdate) return;
  if (!isDrawing.value || !collab?.ydoc.value) return;
  if (ev.pointerId !== activeDrawingPointerId) return;
  ev.preventDefault();
  const { nx, ny } = pushDistinctDraftPoint(ev);
  localCursorPos.value = { nx, ny };
  updateLocalCursor();
  scheduleDrawingAwareness(nx, ny);
  requestPaint();
}

function onPointerDown(ev: PointerEvent) {
  if (ev.button !== 0) return;
  if (!collab?.ydoc.value || connectionStatus.value !== "connected") return;
  ev.preventDefault();
  activeDrawingPointerId = ev.pointerId;
  surfaceRef.value?.setPointerCapture(ev.pointerId);
  const { nx, ny } = normFromEvent(ev);
  isDrawing.value = true;
  localDraftPts.length = 0;
  localDraftPts.push([nx, ny]);
  localCursorPos.value = { nx, ny };
  updateLocalCursor();
  scheduleAwareness({
    phase: "drawing",
    nx,
    ny,
    width: brushWidthNorm.value,
    erase: isEraser.value,
    color: brushColor.value,
  });
  requestPaint();
}

function onPointerMove(ev: PointerEvent) {
  if (isDrawing.value && collab?.ydoc.value) {
    if (ev.pointerId !== activeDrawingPointerId) return;
    ev.preventDefault();
    let lastNx = 0;
    let lastNy = 0;
    const raw =
      typeof ev.getCoalescedEvents === "function"
        ? ev.getCoalescedEvents()
        : [];
    const queue = raw.length > 0 ? raw : [ev];
    for (const e of queue) {
      const p = pushDistinctDraftPoint(e);
      lastNx = p.nx;
      lastNy = p.ny;
    }
    if (usePointerRawUpdate && raw.length === 0) {
      const p = normFromEvent(ev);
      lastNx = p.nx;
      lastNy = p.ny;
    }
    localCursorPos.value = { nx: lastNx, ny: lastNy };
    updateLocalCursor();
    scheduleDrawingAwareness(lastNx, lastNy);
    requestPaint();
    return;
  }
  const { nx, ny } = normFromEvent(ev);
  if (surfaceRef.value?.contains(ev.target as Node)) {
    localCursorPos.value = { nx, ny };
    updateLocalCursor();
    scheduleAwareness({
      phase: "hover",
      nx,
      ny,
      width: brushWidthNorm.value,
      erase: isEraser.value,
      color: brushColor.value,
    });
  }
}

function commitStroke() {
  const doc = collab?.ydoc.value;
  const arr = strokesArray.value;
  if (!doc || !arr) return;
  if (localDraftPts.length < 1) return;
  const normalizedPts =
    localDraftPts.length === 1 ? [localDraftPts[0]] : localDraftPts;

  doc.transact(() => {
    const m = new Y.Map<unknown>();
    m.set("id", crypto.randomUUID());
    m.set("pts", JSON.stringify(normalizedPts));
    m.set("color", brushColor.value);
    m.set("width", brushWidthNorm.value);
    m.set("erase", isEraser.value);
    arr.push([m]);
    while (arr.length > WHITEBOARD_MAX_STROKES) {
      arr.delete(0, 1);
    }
  });
  whiteboardUndoManager?.stopCapturing();
  schedulePersistRoom();
}

function onPointerUp(ev: PointerEvent) {
  if (isDrawing.value) {
    if (ev.pointerId !== activeDrawingPointerId) return;
    ev.preventDefault();
    pushDistinctDraftPoint(ev);
    try {
      surfaceRef.value?.releasePointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    activeDrawingPointerId = -1;
    isDrawing.value = false;
    commitStroke();
    localDraftPts.length = 0;
    const { nx, ny } = normFromEvent(ev);
    localCursorPos.value = { nx, ny };
    updateLocalCursor();
    scheduleAwareness({
      phase: "hover",
      nx,
      ny,
      width: brushWidthNorm.value,
      erase: isEraser.value,
      color: brushColor.value,
    });
    requestPaint();
  }
}

function onPointerLeave() {
  if (isDrawing.value) return;
  clearWhiteboardAwareness();
  localCursorPos.value = null;
  localCursor.value = null;
  updateRemoteCursors();
}

function performClearAll() {
  const doc = collab?.ydoc.value;
  const arr = strokesArray.value;
  if (!doc || !arr) return;
  whiteboardUndoManager?.stopCapturing();
  doc.transact(() => {
    while (arr.length > 0) {
      arr.delete(0, 1);
    }
  });
  whiteboardUndoManager?.stopCapturing();
  flushPersistRoomNow();
}

function confirmClearAll() {
  performClearAll();
  showClearConfirm.value = false;
}

function exportToJpg() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const w = canvas.width;
  const h = canvas.height;
  if (w < 1 || h < 1) return;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d");
  if (!octx) return;
  octx.fillStyle = "#141414";
  octx.fillRect(0, 0, w, h);
  octx.drawImage(canvas, 0, 0);
  out.toBlob(
    (blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `whiteboard-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    },
    "image/jpeg",
    0.92,
  );
}

watch(
  () => collab?.ydoc.value,
  (doc) => {
    bindStrokes(doc ?? null);
  },
  { immediate: true },
);

watch(
  () => collab?.awareness.value,
  (aw, prevAw) => {
    if (prevAw) {
      prevAw.off("change", updateRemoteCursors);
    }
    if (aw) {
      aw.on("change", updateRemoteCursors);
    }
    updateRemoteCursors();
  },
  { immediate: true },
);

onMounted(() => {
  refreshSurfaceMetrics();
  const surface = surfaceRef.value;
  if (!surface || typeof ResizeObserver === "undefined") return;
  ro = new ResizeObserver(() => {
    refreshSurfaceMetrics();
    requestPaint();
    updateRemoteCursors();
    updateLocalCursor();
  });
  ro.observe(surface);
});

onBeforeUnmount(() => {
  if (persistRoomTimer !== null) {
    window.clearTimeout(persistRoomTimer);
    persistRoomTimer = null;
  }
  flushPersistRoomNow();
  ro?.disconnect();
  ro = null;
  if (rafAwareness) {
    cancelAnimationFrame(rafAwareness);
    rafAwareness = 0;
  }
  if (paintRaf) {
    cancelAnimationFrame(paintRaf);
    paintRaf = 0;
  }
  const arr = strokesArray.value;
  if (arr) {
    arr.unobserve(onStrokesChanged);
  }
  if (whiteboardUndoManager) {
    whiteboardUndoManager.destroy();
    whiteboardUndoManager = null;
  }
  syncWhiteboardUndoUi();
  collab?.awareness.value?.off("change", updateRemoteCursors);
  clearWhiteboardAwareness();
  localCursorPos.value = null;
  localCursor.value = null;
});
</script>

<style scoped>
.collab-whiteboard {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  height: 100%;
  min-height: 240px;
  background: #1a1a1a;
  border: 2px solid #444;
  overflow-x: visible;
  overflow-y: hidden;
  position: relative;
}

.collab-whiteboard--embedded {
  border: none;
  flex: 0 0 auto;
  width: 100%;
  height: auto;
  max-height: none;
  min-height: 0;
  overflow: visible;
}

.collab-whiteboard__toolbar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 2px solid #444;
  background: #2a2a2a;
  overflow: visible;
  position: relative;
  z-index: 4;
}

.collab-whiteboard__toolbar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  overflow: visible;
}

.collab-whiteboard__eraser-icon {
  display: block;
  object-fit: contain;
  image-rendering: crisp-edges;
  pointer-events: none;
}

.collab-whiteboard__sizes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.collab-whiteboard__toolbar-tail {
  margin-left: auto;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.collab-whiteboard__header {
  padding: 12px 16px;
  border-bottom: 2px solid #444;
  background: #2a2a2a;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.collab-whiteboard__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #bab1a8;
  font-family: "Bebas Neue", sans-serif;
  letter-spacing: 0.02em;
}

.collab-whiteboard__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.collab-whiteboard__status {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  color: #999;
}

.collab-whiteboard__status--connecting {
  color: #ffc866;
}

.collab-whiteboard__status--disconnected {
  color: #e2534b;
}

.collab-whiteboard__surface-slot {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: #141414;
}

.collab-whiteboard__surface-slot--embedded {
  flex: 0 0 auto;
  min-height: unset;
  overflow: visible;
  align-items: center;
  justify-content: center;
}

.collab-whiteboard__surface {
  position: relative;
  flex: 0 0 auto;
  flex-shrink: 0;
  width: 100%;
  max-width: 100%;
  height: auto;
  aspect-ratio: 376 / 444;
  box-sizing: border-box;
  touch-action: none;
  cursor: none;
  background: #141414;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.collab-whiteboard__surface--eraser {
  cursor: none;
}

.collab-whiteboard__canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  -webkit-touch-callout: none;
}

.collab-whiteboard__cursors {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.collab-whiteboard__cursor {
  position: absolute;
  left: 0;
  top: 0;
  width: var(--cursor-size, 12px);
  height: var(--cursor-size, 12px);
  border-width: var(--cursor-border, 2px);
  border-style: solid;
  border-color: #fff;
  border-radius: 50%;
  box-sizing: border-box;
  pointer-events: none;
  will-change: transform;
}

.collab-whiteboard__cursor--eraser {
  border-style: dashed;
}

.collab-whiteboard__cursor-label {
  position: absolute;
  left: calc(var(--cursor-size, 12px) * 0.7);
  top: calc(-1 * var(--cursor-size, 12px));
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
  opacity: 0.9;
}

.collab-whiteboard__confirm-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
  color: #bab1a8;
}
</style>
