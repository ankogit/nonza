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
          variant="danger"
          class="collab-whiteboard__button"
          title="Очистить доску"
          aria-label="Очистить доску"
          @click="handleClearAll"
        >
          <PixelIcon name="delete" variant="small" />
        </Button>
        <div
          v-if="connectionStatus !== 'connected'"
          class="collab-whiteboard__status"
          :class="{
            'collab-whiteboard__status--connecting':
              connectionStatus === 'connecting',
            'collab-whiteboard__status--disconnected':
              connectionStatus === 'disconnected',
          }"
        >
          {{
            connectionStatus === "connecting" ? "Подключение..." : "Отключено"
          }}
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
          @update:model-value="isEraser = false"
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
          type="text"
          size="tiny"
          :variant="isEraser ? 'active' : 'default'"
          title="Ластик"
          aria-label="Ластик"
          :aria-pressed="isEraser"
          @click="isEraser = !isEraser"
        >
          Ластик
        </Button>
        <div v-if="embedded" class="collab-whiteboard__toolbar-tail">
          <Button
            type="icon"
            size="tiny"
            variant="danger"
            class="collab-whiteboard__button"
            title="Очистить доску"
            aria-label="Очистить доску"
            @click="handleClearAll"
          >
            <PixelIcon name="delete" variant="small" />
          </Button>
        </div>
      </div>
    </div>

    <div
      ref="surfaceRef"
      class="collab-whiteboard__surface"
      :class="{ 'collab-whiteboard__surface--eraser': isEraser }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerLeave"
    >
      <canvas ref="canvasRef" class="collab-whiteboard__canvas" />
      <div class="collab-whiteboard__cursors">
        <div
          v-for="p in remoteCursors"
          :key="p.clientId"
          class="collab-whiteboard__cursor"
          :style="{
            transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`,
            borderColor: p.color,
          }"
        >
          <span
            class="collab-whiteboard__cursor-label"
            :style="{ background: p.color }"
            >{{ p.name }}</span
          >
        </div>
      </div>
    </div>
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
import { Button, PixelIcon, ParticipantColorPalette } from "@shared/ui";
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
}>();

const collab = inject(MEET_ROOM_COLLABORATION_KEY, null);

const widthPresets = [
  { id: "s", label: "S", n: 0.004, title: "Тонкая" },
  { id: "m", label: "M", n: 0.02, title: "Средняя" },
  { id: "l", label: "L", n: 0.05, title: "Толстая" },
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

watch(
  () => props.participantColor,
  (c) => {
    if (typeof c === "string" && c.trim() !== "") {
      brushColor.value = c.trim();
    }
  },
);

const connectionStatus = computed(() => {
  if (!collab) return "disconnected" as const;
  return collab.connectionStatus.value;
});

const surfaceRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

const strokesArray = shallowRef<Y.Array<Y.Map<unknown>> | null>(null);

const localDraft = ref<[number, number][]>([]);
const isDrawing = ref(false);

let rafAwareness = 0;
let pendingAwareness: WhiteboardAwarenessPayload | null = null;

const remoteCursors = ref<
  Array<{
    clientId: number;
    x: number;
    y: number;
    color: string;
    name: string;
  }>
>([]);

function getSurfaceSize() {
  const el = surfaceRef.value;
  if (!el) return { w: 0, h: 0 };
  const r = el.getBoundingClientRect();
  return { w: r.width, h: r.height };
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
  const out: Array<{
    pts: [number, number][];
    color: string;
    width: number;
    erase: boolean;
  }> = [];
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
      if (!Array.isArray(pts) || pts.length < 2) continue;
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

  const { w, h } = getSurfaceSize();
  if (w < 1 || h < 1) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const arr = strokesArray.value;
  if (arr) {
    const snapshots = snapshotStrokes(arr);
    const minDim = Math.min(w, h);
    for (const s of snapshots) {
      ctx.beginPath();
      const [fx, fy] = s.pts[0];
      ctx.moveTo(fx * w, fy * h);
      for (let i = 1; i < s.pts.length; i++) {
        const [nx, ny] = s.pts[i];
        ctx.lineTo(nx * w, ny * h);
      }
      ctx.lineWidth = Math.max(1, s.width * minDim);
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

  if (localDraft.value.length >= 2) {
    const minDim = Math.min(w, h);
    ctx.beginPath();
    const [fx, fy] = localDraft.value[0];
    ctx.moveTo(fx * w, fy * h);
    for (let i = 1; i < localDraft.value.length; i++) {
      const [nx, ny] = localDraft.value[i];
      ctx.lineTo(nx * w, ny * h);
    }
    ctx.lineWidth = Math.max(1, brushWidthNorm.value * minDim);
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

let paintRaf = 0;
function requestPaint() {
  if (paintRaf) return;
  paintRaf = requestAnimationFrame(() => {
    paintRaf = 0;
    paintCanvas();
  });
}

function bindStrokes(doc: Y.Doc | null) {
  const prev = strokesArray.value;
  if (prev) {
    prev.unobserve(requestPaint);
  }
  strokesArray.value = null;
  if (!doc) {
    requestPaint();
    return;
  }
  const arr = doc.getArray<Y.Map<unknown>>(WHITEBOARD_YARRAY_KEY);
  strokesArray.value = arr;
  arr.observe(requestPaint);
  requestPaint();
}

function updateRemoteCursors() {
  const aw = collab?.awareness.value;
  const surface = surfaceRef.value;
  if (!aw || !surface) {
    remoteCursors.value = [];
    return;
  }
  const { w, h } = getSurfaceSize();
  const list: (typeof remoteCursors.value)[number][] = [];
  aw.getStates().forEach((state, clientId) => {
    if (clientId === aw.clientID) return;
    const wb = state.whiteboard as WhiteboardAwarenessPayload | undefined;
    const user = state.user as { name?: string; color?: string } | undefined;
    if (!wb || !user?.name) return;
    list.push({
      clientId,
      x: wb.nx * w,
      y: wb.ny * h,
      color: user.color ?? "#888",
      name: user.name,
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

function onPointerDown(ev: PointerEvent) {
  if (!collab?.ydoc.value || connectionStatus.value !== "connected") return;
  ev.preventDefault();
  surfaceRef.value?.setPointerCapture(ev.pointerId);
  const { nx, ny } = normFromEvent(ev);
  isDrawing.value = true;
  localDraft.value = [[nx, ny]];
  scheduleAwareness({ phase: "drawing", nx, ny });
  requestPaint();
}

function onPointerMove(ev: PointerEvent) {
  const { nx, ny } = normFromEvent(ev);
  if (isDrawing.value && collab?.ydoc.value) {
    ev.preventDefault();
    const last = localDraft.value[localDraft.value.length - 1];
    if (!last || last[0] !== nx || last[1] !== ny) {
      localDraft.value = [...localDraft.value, [nx, ny]];
    }
    scheduleAwareness({ phase: "drawing", nx, ny });
    requestPaint();
    return;
  }
  if (surfaceRef.value?.contains(ev.target as Node)) {
    scheduleAwareness({ phase: "hover", nx, ny });
  }
}

function commitStroke() {
  const doc = collab?.ydoc.value;
  const arr = strokesArray.value;
  if (!doc || !arr) return;
  const pts = localDraft.value;
  if (pts.length < 2) return;

  doc.transact(() => {
    const m = new Y.Map<unknown>();
    m.set("id", crypto.randomUUID());
    m.set("pts", JSON.stringify(pts));
    m.set("color", brushColor.value);
    m.set("width", brushWidthNorm.value);
    m.set("erase", isEraser.value);
    arr.push([m]);
    while (arr.length > WHITEBOARD_MAX_STROKES) {
      arr.delete(0, 1);
    }
  });
}

function onPointerUp(ev: PointerEvent) {
  if (isDrawing.value) {
    ev.preventDefault();
    try {
      surfaceRef.value?.releasePointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    isDrawing.value = false;
    commitStroke();
    localDraft.value = [];
    const { nx, ny } = normFromEvent(ev);
    scheduleAwareness({ phase: "hover", nx, ny });
    requestPaint();
  }
}

function onPointerLeave() {
  if (isDrawing.value) return;
  clearWhiteboardAwareness();
  updateRemoteCursors();
}

function handleClearAll() {
  const doc = collab?.ydoc.value;
  const arr = strokesArray.value;
  if (!doc || !arr) return;
  doc.transact(() => {
    while (arr.length > 0) {
      arr.delete(0, 1);
    }
  });
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
  const surface = surfaceRef.value;
  if (!surface || typeof ResizeObserver === "undefined") return;
  ro = new ResizeObserver(() => {
    requestPaint();
    updateRemoteCursors();
  });
  ro.observe(surface);
});

onBeforeUnmount(() => {
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
    arr.unobserve(requestPaint);
  }
  collab?.awareness.value?.off("change", updateRemoteCursors);
  clearWhiteboardAwareness();
});
</script>

<style scoped>
.collab-whiteboard {
  display: flex;
  flex-direction: column;
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
  min-height: 0;
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

.collab-whiteboard__surface {
  position: relative;
  flex: 1;
  min-height: 200px;
  touch-action: none;
  cursor: crosshair;
  background: #141414;
}

.collab-whiteboard__surface--eraser {
  cursor: cell;
}

.collab-whiteboard--embedded .collab-whiteboard__surface {
  min-height: 180px;
}

.collab-whiteboard__canvas {
  display: block;
  width: 100%;
  height: 100%;
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
  width: 12px;
  height: 12px;
  border: 2px solid #fff;
  border-radius: 50%;
  box-sizing: border-box;
  pointer-events: none;
  will-change: transform;
}

.collab-whiteboard__cursor-label {
  position: absolute;
  left: 10px;
  top: -20px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
  opacity: 0.9;
}
</style>
