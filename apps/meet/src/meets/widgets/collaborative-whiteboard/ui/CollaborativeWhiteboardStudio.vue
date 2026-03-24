<template>
  <div class="studio">
    <div ref="viewportRef" class="studio__viewport">
      <div
        ref="stageFrameRef"
        class="studio__stage-frame"
        @wheel.prevent="onStageWheel"
      >
        <div class="studio__view" :style="viewStyle">
        <div class="studio__expand-wrap">
          <button
            type="button"
            class="studio__expand studio__expand--edge studio__expand--top"
            title="Расширить холст вверх"
            aria-label="Расширить холст вверх"
            @pointerdown.stop
            @click="expandDoc('top')"
          >
            +
          </button>
          <div class="studio__expand-row">
            <button
              type="button"
              class="studio__expand studio__expand--edge studio__expand--left"
              title="Расширить холст влево"
              aria-label="Расширить холст влево"
              @pointerdown.stop
              @click="expandDoc('left')"
            >
              +
            </button>
            <div ref="stageRef" class="studio__stage">
              <canvas
                ref="canvasRef"
                class="studio__canvas"
                :class="canvasCursorClass"
                @pointerdown="onCanvasPointerDown"
                @pointermove="onCanvasPointerMove"
                @pointerup="onCanvasPointerUp"
                @pointercancel="onCanvasPointerUp"
                @pointerleave="onCanvasPointerLeave"
              />
              <div class="studio__cursors">
                <div
                  v-for="p in remoteCursors"
                  :key="p.clientId"
                  class="studio__cursor"
                  :style="{
                    transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`,
                    borderColor: p.color,
                  }"
                >
                  <span class="studio__cursor-label" :style="{ background: p.color }">{{
                    p.name
                  }}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              class="studio__expand studio__expand--edge studio__expand--right"
              title="Расширить холст вправо"
              aria-label="Расширить холст вправо"
              @pointerdown.stop
              @click="expandDoc('right')"
            >
              +
            </button>
          </div>
          <button
            type="button"
            class="studio__expand studio__expand--edge studio__expand--bottom"
            title="Расширить холст вниз"
            aria-label="Расширить холст вниз"
            @pointerdown.stop
            @click="expandDoc('bottom')"
          >
            +
          </button>
        </div>
        </div>
      </div>

      <div
        v-show="showNavPanel"
        ref="navPanelRef"
        class="studio__panel studio__panel--nav"
        :style="navStyle"
      >
        <div class="studio__panel-head" @pointerdown="(e) => startDrag('nav', e)">
          <span class="studio__cross" @pointerdown.stop @click.stop="showNavPanel = false">×</span>
        </div>
        <div class="studio__panel-body">
          <img :src="previewMain" alt="" class="studio__thumb" draggable="false" />
        </div>
      </div>

      <div
        v-show="showBrushPanel"
        ref="brushPanelRef"
        class="studio__panel studio__panel--brush"
        :style="brushStyle"
      >
        <div class="studio__panel-head" @pointerdown="(e) => startDrag('brush', e)">
          <span class="studio__cross" @pointerdown.stop @click.stop="toggleBrushPanel">×</span>
        </div>
        <div class="studio__panel-body">
          <label class="studio__label" for="studio-brush-size">Size</label>
          <div class="studio__size-preview-wrap">
            <span
              class="studio__size-preview"
              :style="{
                width: brushSize + 'px',
                height: brushSize + 'px',
                background: brushPreviewColor,
              }"
            />
          </div>
          <input
            id="studio-brush-size"
            v-model.number="brushSize"
            type="range"
            class="studio__range"
            min="1"
            max="80"
            @input="syncBrushStyle"
          />
          <label class="studio__label" for="studio-brush-opacity">Opacity</label>
          <input
            id="studio-brush-opacity"
            v-model.number="brushOpacity"
            type="range"
            class="studio__range"
            min="0.1"
            max="1"
            step="0.1"
            @input="syncBrushStyle"
          />
        </div>
      </div>

      <div
        v-show="showSprayPanel"
        ref="sprayPanelRef"
        class="studio__panel studio__panel--spray"
        :style="sprayStyle"
      >
        <div class="studio__panel-head" @pointerdown="(e) => startDrag('spray', e)">
          <span class="studio__cross" @pointerdown.stop @click.stop="toggleSpray">×</span>
        </div>
        <div class="studio__panel-body">
          <label class="studio__label" for="studio-spray-density">Density</label>
          <input
            id="studio-spray-density"
            v-model.number="sprayDensity"
            type="range"
            class="studio__range"
            min="5"
            max="300"
          />
          <label class="studio__label" for="studio-spray-radius">Radius</label>
          <input
            id="studio-spray-radius"
            v-model.number="sprayRadius"
            type="range"
            class="studio__range"
            min="20"
            max="80"
            step="1"
          />
        </div>
      </div>

      <div ref="toolbarRef" class="studio__toolbar" :style="toolbarStyle">
        <div class="studio__toolbar-title" @pointerdown="(e) => startDrag('toolbar', e)">
          ⋮
        </div>
        <button
          type="button"
          class="studio__tool"
          :class="{ 'studio__tool--on': drawingTool === 'freehand' }"
          title="Кисть"
          @pointerdown.stop
          @click="setDrawingTool('freehand')"
        >
          ✏
        </button>
        <button
          type="button"
          class="studio__tool"
          :class="{ 'studio__tool--on': showBrushPanel }"
          title="Brush size and opacity"
          @pointerdown.stop
          @click="openBrush"
        >
          🖌
        </button>
        <button
          type="button"
          class="studio__tool"
          :class="{ 'studio__tool--on': drawingTool === 'line' }"
          title="Линия"
          @pointerdown.stop
          @click="setDrawingTool('line')"
        >
          ╱
        </button>
        <button
          type="button"
          class="studio__tool"
          :class="{ 'studio__tool--on': drawingTool === 'rect' }"
          title="Прямоугольник"
          @pointerdown.stop
          @click="setDrawingTool('rect')"
        >
          ▢
        </button>
        <button
          type="button"
          class="studio__tool"
          :class="{ 'studio__tool--on': drawingTool === 'ellipse' }"
          title="Эллипс"
          @pointerdown.stop
          @click="setDrawingTool('ellipse')"
        >
          ◯
        </button>
        <button
          type="button"
          class="studio__tool"
          :class="{ 'studio__tool--on': drawingTool === 'text' }"
          title="Текст"
          @pointerdown.stop
          @click="setDrawingTool('text')"
        >
          T
        </button>
        <button
          type="button"
          class="studio__tool"
          :class="{ 'studio__tool--on': canRain }"
          title="Rainbow brush"
          @pointerdown.stop
          @click="toggleRain"
        >
          🌈
        </button>
        <button
          type="button"
          class="studio__tool"
          :class="{ 'studio__tool--on': canSpray }"
          title="Spray"
          @pointerdown.stop
          @click="toggleSpray"
        >
          💨
        </button>
        <button
          type="button"
          class="studio__tool"
          :class="{ 'studio__tool--on': toolMode === 'fill' }"
          title="Заливка области"
          @pointerdown.stop
          @click="toggleFillTool"
        >
          🪣
        </button>
        <button
          type="button"
          class="studio__tool"
          :class="{ 'studio__tool--on': toolMode === 'hand' }"
          title="Рука — перемещение"
          @pointerdown.stop
          @click="toggleHandTool"
        >
          ✋
        </button>
        <button
          type="button"
          class="studio__tool"
          :class="{ 'studio__tool--on': canErase }"
          title="Eraser"
          @pointerdown.stop
          @click="toggleErase"
        >
          ⌫
        </button>
        <button
          type="button"
          class="studio__tool"
          :class="{ 'studio__tool--on': showNavPanel }"
          title="Navigator"
          @pointerdown.stop
          @click="showNavPanel = !showNavPanel"
        >
          🧭
        </button>
        <button
          type="button"
          class="studio__tool"
          title="Save to browser"
          @pointerdown.stop
          @click="saveCanvas"
        >
          💾
        </button>
        <button type="button" class="studio__tool" title="Clear" @pointerdown.stop @click="clearCanvas">
          🗑
        </button>
        <a
          class="studio__tool studio__tool--link"
          title="Download PNG"
          :href="downloadUrl"
          download="nonza-drawing.png"
          @pointerdown.stop
          @click="refreshDownload"
        >
          ⬇
        </a>
        <input
          v-model="colorHex"
          type="color"
          class="studio__color"
          aria-label="Color"
          @pointerdown.stop
          @input="onColorPick"
        />
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="textInputVisible"
        class="studio__text-layer"
        @pointerdown.self="cancelTextInput"
      >
        <div
          class="studio__text-pop"
          :style="{ left: textInputPos.x + 'px', top: textInputPos.y + 'px' }"
          @pointerdown.stop
        >
          <input
            ref="textInputRef"
            v-model="textDraft"
            class="studio__text-field"
            type="text"
            maxlength="500"
            placeholder="Текст"
            @keydown.enter.prevent="commitTextInput"
            @keydown.esc.prevent="cancelTextInput"
          />
          <button
            type="button"
            class="studio__text-ok"
            @click="commitTextInput"
          >
            OK
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  shallowRef,
  computed,
  reactive,
  inject,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
} from "vue";
import * as Y from "yjs";
import type { Transaction } from "yjs";
import { MEET_ROOM_COLLABORATION_KEY } from "@features/room-collaboration";
import type { MeetRoomCollaborationBundle } from "@features/room-collaboration";
import { WHITEBOARD_STUDIO_YMAP_KEY } from "../model/constants";
import type { WhiteboardAwarenessPayload } from "../model/types";
import {
  getRandomInt,
  rgbToHsl,
  floodFillAt,
} from "../lib/studioCanvasHelpers";

const STUDIO_ORIGIN = "wb-studio-local";
const DEFAULT_DOC_W = 800;
const DEFAULT_DOC_H = 400;
const EXPAND_DOC_W = 800;
const EXPAND_DOC_H = 400;
const MAX_DOC_EDGE = 16000;
const STUDIO_PUSH_DEBOUNCE_MS = 3000;
const PREVIEW_DEBOUNCE_MS = 400;
const RESIZE_DEBOUNCE_MS = 48;

let suppressResizeSnap = false;

function fitContain(docW: number, docH: number, frameW: number, frameH: number) {
  const fw = Math.max(1, frameW);
  const fh = Math.max(1, frameH);
  const ar = docW / docH;
  let w = fw;
  let h = w / ar;
  if (h > fh) {
    h = fh;
    w = h * ar;
  }
  return {
    w: Math.max(1, Math.floor(w)),
    h: Math.max(1, Math.floor(h)),
  };
}

const PLACEHOLDER_IMG =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="68"><rect fill="#333" width="100%" height="100%"/></svg>',
  );

const props = defineProps<{
  participantColor: string;
  roomId?: string | null;
}>();

const collab = inject(MEET_ROOM_COLLABORATION_KEY, null) as MeetRoomCollaborationBundle | null;

const studioMap = shallowRef<Y.Map<string> | null>(null);
const applyingRemote = ref(false);
let unbindStudioMap: (() => void) | null = null;
let persistTimer: number | null = null;
let pushToYTimer: ReturnType<typeof setTimeout> | null = null;

const viewportRef = ref<HTMLElement | null>(null);
const toolbarRef = ref<HTMLElement | null>(null);
const brushPanelRef = ref<HTMLElement | null>(null);
const sprayPanelRef = ref<HTMLElement | null>(null);
const navPanelRef = ref<HTMLElement | null>(null);
const stageFrameRef = ref<HTMLElement | null>(null);
const stageRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

const previewMain = ref(PLACEHOLDER_IMG);
const downloadUrl = ref(PLACEHOLDER_IMG);

type ToolMode = "draw" | "hand" | "fill";
const toolMode = ref<ToolMode>("draw");

type DrawingTool = "freehand" | "line" | "rect" | "ellipse" | "text";
const drawingTool = ref<DrawingTool>("freehand");

const textInputVisible = ref(false);
const textInputPos = ref({ x: 0, y: 0 });
const textDraft = ref("");
const textInputRef = ref<HTMLInputElement | null>(null);
const textAnchor = ref<{ xd: number; yd: number } | null>(null);

let shapeSnap: HTMLCanvasElement | null = null;
let shapeStart: { x: number; y: number } | null = null;

const viewPanX = ref(0);
const viewPanY = ref(0);
const viewZoom = ref(1);

const viewStyle = computed(() => ({
  transform: `translate(${viewPanX.value}px, ${viewPanY.value}px) scale(${viewZoom.value})`,
}));

const canvasCursorClass = computed(() => {
  if (toolMode.value === "hand") return "studio__canvas--grab";
  if (toolMode.value === "fill") return "studio__canvas--fill";
  if (drawingTool.value === "text") return "studio__canvas--text";
  if (drawingTool.value !== "freehand") return "studio__canvas--crosshair";
  return "studio__canvas--draw";
});

let isPanning = false;
let panGrab = { x: 0, y: 0, px: 0, py: 0 };

const colorHex = ref("#e53935");
const brushSize = ref(10);
const brushOpacity = ref(1);
const brushPreviewColor = ref("hsla(0,72%,55%,1)");

const canSpray = ref(false);
const sprayDensity = ref(50);
const sprayRadius = ref(20);

const canErase = ref(false);
const canRain = ref(false);
const hue = ref(0);

const showBrushPanel = ref(false);
const showSprayPanel = ref(false);
const showNavPanel = ref(true);

type PanelKey = "toolbar" | "brush" | "spray" | "nav";
const panelPos = reactive<Record<PanelKey, { x: number; y: number }>>({
  toolbar: { x: 12, y: 120 },
  brush: { x: 12, y: 12 },
  spray: { x: 12, y: 12 },
  nav: { x: 12, y: 12 },
});

const toolbarStyle = computed(
  () =>
    ({
      left: `${panelPos.toolbar.x}px`,
      top: `${panelPos.toolbar.y}px`,
    }) as Record<string, string>,
);

const brushStyle = computed(
  () =>
    ({
      left: `${panelPos.brush.x}px`,
      top: `${panelPos.brush.y}px`,
    }) as Record<string, string>,
);

const sprayStyle = computed(
  () =>
    ({
      left: `${panelPos.spray.x}px`,
      top: `${panelPos.spray.y}px`,
    }) as Record<string, string>,
);

const navStyle = computed(
  () =>
    ({
      right: `${panelPos.nav.x}px`,
      top: `${panelPos.nav.y}px`,
    }) as Record<string, string>,
);

let drag: {
  key: PanelKey;
  startX: number;
  startY: number;
  orig: { x: number; y: number };
} | null = null;

const VIEWPORT_PAD = 8;

function clampPanelKey(key: PanelKey) {
  const vp = viewportRef.value;
  if (!vp) return;
  const vw = vp.clientWidth;
  const vh = vp.clientHeight;
  if (vw < 16 || vh < 16) return;

  if (key === "nav") {
    if (!showNavPanel.value) return;
    const el = navPanelRef.value;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const maxRight = Math.max(0, vw - w - VIEWPORT_PAD);
    const maxTop = Math.max(VIEWPORT_PAD, vh - h - VIEWPORT_PAD);
    panelPos.nav.x = Math.min(Math.max(0, panelPos.nav.x), maxRight);
    panelPos.nav.y = Math.min(Math.max(VIEWPORT_PAD, panelPos.nav.y), maxTop);
    return;
  }

  if (key === "brush" && !showBrushPanel.value) return;
  if (key === "spray" && !showSprayPanel.value) return;

  const el =
    key === "toolbar"
      ? toolbarRef.value
      : key === "brush"
        ? brushPanelRef.value
        : sprayPanelRef.value;
  if (!el) return;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const maxX = Math.max(VIEWPORT_PAD, vw - w - VIEWPORT_PAD);
  const maxY = Math.max(VIEWPORT_PAD, vh - h - VIEWPORT_PAD);
  panelPos[key].x = Math.min(Math.max(VIEWPORT_PAD, panelPos[key].x), maxX);
  panelPos[key].y = Math.min(Math.max(VIEWPORT_PAD, panelPos[key].y), maxY);
}

function clampAllPanels() {
  clampPanelKey("toolbar");
  clampPanelKey("brush");
  clampPanelKey("spray");
  clampPanelKey("nav");
}

function startDrag(key: PanelKey, e: PointerEvent) {
  if ((e.target as HTMLElement).closest(".studio__cross")) return;
  if (key === "nav" && (e.target as HTMLElement).tagName === "IMG") return;
  drag = {
    key,
    startX: e.clientX,
    startY: e.clientY,
    orig: { ...panelPos[key] },
  };
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onDragPointerMove(e: PointerEvent) {
  if (!drag) return;
  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;
  if (drag.key === "nav") {
    panelPos.nav = { x: drag.orig.x - dx, y: drag.orig.y + dy };
  } else {
    panelPos[drag.key] = {
      x: drag.orig.x + dx,
      y: drag.orig.y + dy,
    };
  }
  clampPanelKey(drag.key);
}

function onDragPointerUp(e: PointerEvent) {
  drag = null;
  try {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
}

const isDrawing = ref(false);
let lastX = 0;
let lastY = 0;

let ctx: CanvasRenderingContext2D | null = null;
let cw = DEFAULT_DOC_W;
let ch = DEFAULT_DOC_H;

const remoteCursors = ref<
  Array<{ clientId: number; x: number; y: number; color: string; name: string }>
>([]);

let rafAware = 0;
let pendingAware: WhiteboardAwarenessPayload | null = null;

function scheduleAwareness(payload: WhiteboardAwarenessPayload) {
  pendingAware = payload;
  if (rafAware) return;
  rafAware = requestAnimationFrame(() => {
    rafAware = 0;
    const aw = collab?.awareness.value;
    const p = pendingAware;
    pendingAware = null;
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

function pointerCanvasCoords(ev: PointerEvent, r: DOMRect) {
  const lx = ev.clientX - r.left;
  const ly = ev.clientY - r.top;
  const rw = r.width;
  const rh = r.height;
  const nx = rw > 0 ? Math.min(1, Math.max(0, lx / rw)) : 0;
  const ny = rh > 0 ? Math.min(1, Math.max(0, ly / rh)) : 0;
  const xd = rw > 0 ? (lx / rw) * cw : 0;
  const yd = rh > 0 ? (ly / rh) * ch : 0;
  return { xd, yd, nx, ny };
}

function syncBrushStyle() {
  const hex = colorHex.value.replace("#", "");
  const [h, s, l] = rgbToHsl(hex);
  brushPreviewColor.value = `hsla(${h},${s}%,${l}%,${brushOpacity.value})`;
}

function applyStrokeStyle(ctx: CanvasRenderingContext2D) {
  if (canRain.value) {
    ctx.strokeStyle = `hsla(${hue.value},100%,50%,${brushOpacity.value})`;
  } else {
    ctx.strokeStyle = brushPreviewColor.value;
  }
}

function lineWidthPx() {
  const scale = Math.min(cw, ch) / 450;
  return Math.max(1, brushSize.value * scale);
}

function refreshPreviews() {
  const d = canvasRef.value;
  if (d) {
    const url = d.toDataURL("image/png");
    previewMain.value = url;
    downloadUrl.value = url;
  }
}

let previewDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePreview() {
  if (previewDebounceTimer !== null) {
    clearTimeout(previewDebounceTimer);
  }
  previewDebounceTimer = window.setTimeout(() => {
    previewDebounceTimer = null;
    refreshPreviews();
  }, PREVIEW_DEBOUNCE_MS);
}

function flushPreviewNow() {
  if (previewDebounceTimer !== null) {
    clearTimeout(previewDebounceTimer);
    previewDebounceTimer = null;
  }
  refreshPreviews();
}

let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleResizeCanvases() {
  if (resizeDebounceTimer !== null) {
    clearTimeout(resizeDebounceTimer);
  }
  resizeDebounceTimer = window.setTimeout(() => {
    resizeDebounceTimer = null;
    resizeCanvases();
  }, RESIZE_DEBOUNCE_MS);
}

function canvasSnapshotPng(canvas: HTMLCanvasElement): string {
  if (canvas.width < 1 || canvas.height < 1) return "";
  return canvas.toDataURL("image/png");
}

function schedulePersistRoom() {
  if (persistTimer !== null) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    collab?.persistRoomDocument?.();
  }, 2500);
}

function pushStudioToY() {
  const doc = collab?.ydoc.value;
  const map = studioMap.value;
  const prov = collab?.provider.value;
  const d = canvasRef.value;
  if (
    !doc ||
    !map ||
    !prov?.connected ||
    applyingRemote.value ||
    !d ||
    !ctx
  ) {
    return;
  }
  const png = canvasSnapshotPng(d);
  if (!png) return;
  doc.transact(() => {
    map.set("docW", String(cw));
    map.set("docH", String(ch));
    map.set("canvas", png);
  }, STUDIO_ORIGIN);
  schedulePersistRoom();
}

function flushPushStudioToY() {
  if (pushToYTimer !== null) {
    clearTimeout(pushToYTimer);
    pushToYTimer = null;
  }
  pushStudioToY();
}

function schedulePushStudioToY() {
  if (pushToYTimer !== null) {
    clearTimeout(pushToYTimer);
  }
  pushToYTimer = window.setTimeout(() => {
    pushToYTimer = null;
    pushStudioToY();
  }, STUDIO_PUSH_DEBOUNCE_MS);
}

function loadImageToCtx(
  dataUrl: string,
  destCtx: CanvasRenderingContext2D,
  lw: number,
  lh: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      destCtx.clearRect(0, 0, lw, lh);
      if (img.naturalWidth === lw && img.naturalHeight === lh) {
        destCtx.drawImage(img, 0, 0);
      } else {
        destCtx.drawImage(img, 0, 0, lw, lh);
      }
      resolve();
    };
    img.onerror = () => reject(new Error("image"));
    img.src = dataUrl;
  });
}

function drawImageDataUrlOverlay(
  dataUrl: string,
  destCtx: CanvasRenderingContext2D,
  lw: number,
  lh: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth === lw && img.naturalHeight === lh) {
        destCtx.drawImage(img, 0, 0);
      } else {
        destCtx.drawImage(img, 0, 0, lw, lh);
      }
      resolve();
    };
    img.onerror = () => reject(new Error("image"));
    img.src = dataUrl;
  });
}

async function applyStudioFromY() {
  const map = studioMap.value;
  const c = ctx;
  if (!map || !c) return;
  const rawW = map.get("docW");
  const rawH = map.get("docH");
  if (rawW != null && rawH != null) {
    const w =
      typeof rawW === "number" ? rawW : parseInt(String(rawW), 10);
    const h =
      typeof rawH === "number" ? rawH : parseInt(String(rawH), 10);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      const nw = Math.min(MAX_DOC_EDGE, w);
      const nh = Math.min(MAX_DOC_EDGE, h);
      if (nw !== cw || nh !== ch) {
        cw = nw;
        ch = nh;
        resizeCanvases();
      }
    }
  }
  if (cw < 1 || ch < 1) return;
  const merged = map.get("canvas");
  if (typeof merged === "string" && merged.startsWith("data:")) {
    applyingRemote.value = true;
    try {
      await loadImageToCtx(merged, c, cw, ch);
      schedulePreview();
    } catch {
      /* ignore */
    } finally {
      applyingRemote.value = false;
    }
    return;
  }
  const drawData = map.get("draw");
  const bgData = map.get("bg");
  if (
    (typeof drawData !== "string" || !drawData.startsWith("data:")) &&
    (typeof bgData !== "string" || !bgData.startsWith("data:"))
  ) {
    return;
  }
  applyingRemote.value = true;
  try {
    if (typeof bgData === "string" && bgData.startsWith("data:")) {
      await loadImageToCtx(bgData, c, cw, ch);
    } else {
      c.fillStyle = "#ffffff";
      c.fillRect(0, 0, cw, ch);
    }
    if (typeof drawData === "string" && drawData.startsWith("data:")) {
      await drawImageDataUrlOverlay(drawData, c, cw, ch);
    }
    schedulePreview();
  } catch {
    /* ignore */
  } finally {
    applyingRemote.value = false;
  }
}

function bindStudioMap(doc: Y.Doc | null) {
  if (unbindStudioMap) {
    unbindStudioMap();
    unbindStudioMap = null;
  }
  studioMap.value = null;
  if (!doc) return;
  const m = doc.getMap<string>(WHITEBOARD_STUDIO_YMAP_KEY);
  studioMap.value = m;
  const obs = (_e: unknown, tr: Transaction) => {
    if (tr.origin === STUDIO_ORIGIN) return;
    void applyStudioFromY();
  };
  m.observe(obs);
  unbindStudioMap = () => {
    m.unobserve(obs);
  };
  void nextTick(() => {
    window.setTimeout(() => {
      void applyStudioFromY();
    }, 0);
  });
}

watch(
  () => collab?.ydoc.value,
  (doc) => {
    bindStudioMap(doc ?? null);
  },
  { immediate: true },
);

type ExpandDir = "top" | "right" | "bottom" | "left";

function resizeCanvases() {
  const frame = stageFrameRef.value;
  const stage = stageRef.value;
  const d = canvasRef.value;
  if (!frame || !stage || !d) return;
  const cs = getComputedStyle(frame);
  const pl = parseFloat(cs.paddingLeft) || 0;
  const pr = parseFloat(cs.paddingRight) || 0;
  const pt = parseFloat(cs.paddingTop) || 0;
  const pb = parseFloat(cs.paddingBottom) || 0;
  const availW = Math.max(1, frame.clientWidth - pl - pr);
  const availH = Math.max(1, frame.clientHeight - pt - pb);
  const { w: dispW, h: dispH } = fitContain(cw, ch, availW, availH);
  stage.style.width = `${dispW}px`;
  stage.style.height = `${dispH}px`;

  const dpr = window.devicePixelRatio || 1;
  const tw = Math.floor(cw * dpr);
  const th = Math.floor(ch * dpr);
  const bitmapChanged = d.width !== tw || d.height !== th;

  if (!bitmapChanged) {
    d.style.width = `${dispW}px`;
    d.style.height = `${dispH}px`;
    schedulePreview();
    return;
  }

  if (suppressResizeSnap) {
    d.width = tw;
    d.height = th;
    d.style.width = `${dispW}px`;
    d.style.height = `${dispH}px`;
    ctx = d.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cw, ch);
    return;
  }

  let snap: HTMLCanvasElement | null = null;
  if (ctx && d.width > 0 && d.height > 0) {
    snap = document.createElement("canvas");
    snap.width = d.width;
    snap.height = d.height;
    snap.getContext("2d")!.drawImage(d, 0, 0);
  }

  const oldLogicalW = d.width > 0 ? d.width / dpr : cw;
  const oldLogicalH = d.height > 0 ? d.height / dpr : ch;

  d.width = tw;
  d.height = th;
  d.style.width = `${dispW}px`;
  d.style.height = `${dispH}px`;
  ctx = d.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (snap) {
    ctx.drawImage(
      snap,
      0,
      0,
      snap.width,
      snap.height,
      0,
      0,
      oldLogicalW,
      oldLogicalH,
    );
    if (cw > oldLogicalW || ch > oldLogicalH) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(oldLogicalW, 0, cw - oldLogicalW, ch);
      ctx.fillRect(0, oldLogicalH, cw, ch - oldLogicalH);
    }
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cw, ch);
    if (
      studioMap.value &&
      (studioMap.value.get("canvas") ||
        studioMap.value.get("draw") ||
        studioMap.value.get("bg"))
    ) {
      void applyStudioFromY();
      return;
    }
  }
  schedulePreview();
}

function expandDoc(dir: ExpandDir) {
  if (applyingRemote.value) return;
  const ow = cw;
  const oh = ch;
  let nw = ow;
  let nh = oh;
  let ox = 0;
  let oy = 0;
  if (dir === "right") nw = Math.min(MAX_DOC_EDGE, ow + EXPAND_DOC_W);
  else if (dir === "bottom") nh = Math.min(MAX_DOC_EDGE, oh + EXPAND_DOC_H);
  else if (dir === "left") {
    nw = Math.min(MAX_DOC_EDGE, ow + EXPAND_DOC_W);
    ox = EXPAND_DOC_W;
  } else if (dir === "top") {
    nh = Math.min(MAX_DOC_EDGE, oh + EXPAND_DOC_H);
    oy = EXPAND_DOC_H;
  }
  if (nw === ow && nh === oh) return;

  const d = canvasRef.value;
  if (!d || !ctx) return;

  const snapD = document.createElement("canvas");
  snapD.width = d.width;
  snapD.height = d.height;
  snapD.getContext("2d")!.drawImage(d, 0, 0);

  cw = nw;
  ch = nh;
  suppressResizeSnap = true;
  try {
    resizeCanvases();
  } finally {
    suppressResizeSnap = false;
  }

  if (!ctx) return;
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(snapD, 0, 0, snapD.width, snapD.height, ox, oy, ow, oh);
  ctx.fillStyle = "#ffffff";
  if (dir === "right") {
    ctx.fillRect(ow, 0, nw - ow, nh);
  } else if (dir === "bottom") {
    ctx.fillRect(0, oh, nw, nh - oh);
  } else if (dir === "left") {
    ctx.fillRect(0, 0, ox, nh);
  } else if (dir === "top") {
    ctx.fillRect(0, 0, nw, oy);
  }
  schedulePreview();
  schedulePushStudioToY();
}

function restoreCanvasFromShapeSnap() {
  if (!ctx || !shapeSnap || !canvasRef.value) return;
  const d = canvasRef.value;
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, d.width, d.height);
  ctx.drawImage(shapeSnap, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
}

function resetShapeDrag() {
  shapeSnap = null;
  shapeStart = null;
}

function drawShapeStroke(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  kind: "line" | "rect" | "ellipse",
  preview: boolean,
) {
  if (!ctx) return;
  const w = lineWidthPx();
  ctx.save();
  ctx.lineWidth = w;
  if (preview) {
    ctx.setLineDash([6, 4]);
  }
  if (canErase.value) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "#000";
  } else {
    ctx.globalCompositeOperation = "source-over";
    applyStrokeStyle(ctx);
  }
  ctx.beginPath();
  if (kind === "line") {
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
  } else if (kind === "rect") {
    const x = Math.min(x0, x1);
    const y = Math.min(y0, y1);
    const rw = Math.abs(x1 - x0);
    const rh = Math.abs(y1 - y0);
    ctx.rect(x, y, rw, rh);
  } else {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const rx = Math.abs(x1 - x0) / 2;
    const ry = Math.abs(y1 - y0) / 2;
    if (rx > 0.5 && ry > 0.5) {
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function setDrawingTool(tool: DrawingTool) {
  drawingTool.value = tool;
  if (tool !== "freehand") {
    canSpray.value = false;
    showSprayPanel.value = false;
  }
  if (tool !== "text") {
    textInputVisible.value = false;
    textAnchor.value = null;
  }
  toolMode.value = "draw";
}

function openTextInput(ev: PointerEvent) {
  const el = canvasRef.value;
  if (!el) return;
  const { xd, yd } = pointerCanvasCoords(ev, el.getBoundingClientRect());
  textAnchor.value = { xd, yd };
  textInputPos.value = { x: ev.clientX, y: ev.clientY };
  textDraft.value = "";
  textInputVisible.value = true;
  void nextTick(() => {
    textInputRef.value?.focus();
    textInputRef.value?.select();
  });
}

function commitTextInput() {
  const c = ctx;
  const anchor = textAnchor.value;
  if (!c || !anchor) {
    textInputVisible.value = false;
    return;
  }
  const t = textDraft.value.trim();
  textInputVisible.value = false;
  textDraft.value = "";
  textAnchor.value = null;
  if (!t) return;
  const fontPx = Math.max(14, Math.min(96, lineWidthPx() * 4));
  c.save();
  c.globalCompositeOperation = "source-over";
  c.globalAlpha = brushOpacity.value;
  c.font = `${fontPx}px system-ui, -apple-system, sans-serif`;
  c.textBaseline = "top";
  if (canRain.value) {
    c.fillStyle = `hsla(${hue.value},100%,50%,1)`;
  } else {
    c.fillStyle = brushPreviewColor.value;
  }
  c.fillText(t, anchor.xd, anchor.yd);
  c.restore();
  schedulePreview();
  schedulePushStudioToY();
}

function cancelTextInput() {
  textInputVisible.value = false;
  textDraft.value = "";
  textAnchor.value = null;
}

function drawSegment(x: number, y: number) {
  if (!ctx || drawingTool.value !== "freehand") return;
  ctx.lineWidth = lineWidthPx();
  applyStrokeStyle(ctx);
  if (canErase.value) {
    ctx.globalCompositeOperation = "destination-out";
  } else {
    ctx.globalCompositeOperation = "source-over";
  }
  if (canSpray.value) {
    ctx.fillStyle = canRain.value
      ? `hsla(${hue.value},100%,50%,${brushOpacity.value})`
      : brushPreviewColor.value;
    for (let i = sprayDensity.value; i--; ) {
      const ox = getRandomInt(-sprayRadius.value, sprayRadius.value);
      const oy = getRandomInt(-sprayRadius.value, sprayRadius.value);
      ctx.fillRect(lastX + ox, lastY + oy, 1, 1);
    }
    if (canRain.value) {
      hue.value = (hue.value + 1) % 360;
    }
    lastX = x;
    lastY = y;
    return;
  }
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.stroke();
  if (canRain.value) {
    hue.value = (hue.value + 2) % 360;
  }
  lastX = x;
  lastY = y;
}

function onStageWheel(ev: WheelEvent) {
  const frame = stageFrameRef.value;
  if (!frame) return;
  const fr = frame.getBoundingClientRect();
  const mx = ev.clientX - fr.left;
  const my = ev.clientY - fr.top;
  const oz = viewZoom.value;
  const z = Math.min(4, Math.max(0.25, oz * (1 - ev.deltaY * 0.0015)));
  const wx = (mx - viewPanX.value) / oz;
  const wy = (my - viewPanY.value) / oz;
  viewZoom.value = z;
  viewPanX.value = mx - wx * z;
  viewPanY.value = my - wy * z;
}

function toggleFillTool() {
  toolMode.value = toolMode.value === "fill" ? "draw" : "fill";
}

function toggleHandTool() {
  toolMode.value = toolMode.value === "hand" ? "draw" : "hand";
}

function runFloodFillAt(ev: PointerEvent) {
  if (!ctx) return;
  const el = canvasRef.value;
  if (!el) return;
  const { xd, yd } = pointerCanvasCoords(ev, el.getBoundingClientRect());
  const dpr = window.devicePixelRatio || 1;
  floodFillAt(ctx, xd, yd, colorHex.value, brushOpacity.value, dpr);
  schedulePreview();
  schedulePushStudioToY();
}

function onCanvasPointerDown(ev: PointerEvent) {
  if (toolMode.value === "hand") {
    isPanning = true;
    panGrab = {
      x: ev.clientX,
      y: ev.clientY,
      px: viewPanX.value,
      py: viewPanY.value,
    };
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    ev.preventDefault();
    return;
  }
  if (toolMode.value === "fill") {
    ev.preventDefault();
    runFloodFillAt(ev);
    return;
  }
  if (drawingTool.value === "text") {
    ev.preventDefault();
    openTextInput(ev);
    return;
  }
  if (
    drawingTool.value === "line" ||
    drawingTool.value === "rect" ||
    drawingTool.value === "ellipse"
  ) {
    if (!ctx) return;
    ev.preventDefault();
    const el = canvasRef.value;
    if (!el) return;
    shapeSnap = document.createElement("canvas");
    shapeSnap.width = el.width;
    shapeSnap.height = el.height;
    shapeSnap.getContext("2d")!.drawImage(el, 0, 0);
    const { xd, yd, nx, ny } = pointerCanvasCoords(ev, el.getBoundingClientRect());
    shapeStart = { x: xd, y: yd };
    el.setPointerCapture(ev.pointerId);
    isDrawing.value = true;
    scheduleAwareness({ phase: "drawing", nx, ny });
    return;
  }
  if (drawingTool.value !== "freehand") return;
  if (!ctx) return;
  ev.preventDefault();
  const el = canvasRef.value;
  if (!el) return;
  el.setPointerCapture(ev.pointerId);
  const { xd, yd, nx, ny } = pointerCanvasCoords(ev, el.getBoundingClientRect());
  lastX = xd;
  lastY = yd;
  isDrawing.value = true;
  scheduleAwareness({ phase: "drawing", nx, ny });
}

function onCanvasPointerMove(ev: PointerEvent) {
  if (isPanning) {
    ev.preventDefault();
    viewPanX.value = panGrab.px + (ev.clientX - panGrab.x);
    viewPanY.value = panGrab.py + (ev.clientY - panGrab.y);
    return;
  }
  const el = canvasRef.value;
  if (!el) return;
  const { xd, yd, nx, ny } = pointerCanvasCoords(ev, el.getBoundingClientRect());
  if (
    isDrawing.value &&
    ctx &&
    shapeSnap &&
    shapeStart &&
    (drawingTool.value === "line" ||
      drawingTool.value === "rect" ||
      drawingTool.value === "ellipse")
  ) {
    ev.preventDefault();
    restoreCanvasFromShapeSnap();
    drawShapeStroke(
      shapeStart.x,
      shapeStart.y,
      xd,
      yd,
      drawingTool.value,
      true,
    );
    scheduleAwareness({ phase: "drawing", nx, ny });
    return;
  }
  if (isDrawing.value && ctx && drawingTool.value === "freehand") {
    ev.preventDefault();
    drawSegment(xd, yd);
    scheduleAwareness({ phase: "drawing", nx, ny });
    return;
  }
  if (el.contains(ev.target as Node)) {
    scheduleAwareness({ phase: "hover", nx, ny });
  }
}

function onCanvasPointerUp(ev: PointerEvent) {
  if (isPanning) {
    isPanning = false;
    try {
      (ev.currentTarget as HTMLElement).releasePointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    ev.preventDefault();
    return;
  }
  if (shapeSnap && shapeStart && ctx) {
    const kind = drawingTool.value;
    if (kind === "line" || kind === "rect" || kind === "ellipse") {
      ev.preventDefault();
      const el = canvasRef.value;
      if (!el) {
        resetShapeDrag();
        isDrawing.value = false;
        return;
      }
      const { xd, yd, nx, ny } = pointerCanvasCoords(
        ev,
        el.getBoundingClientRect(),
      );
      restoreCanvasFromShapeSnap();
      drawShapeStroke(shapeStart.x, shapeStart.y, xd, yd, kind, false);
      resetShapeDrag();
      isDrawing.value = false;
      try {
        el.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      scheduleAwareness({ phase: "hover", nx, ny });
      schedulePreview();
      schedulePushStudioToY();
      return;
    }
  }
  if (!isDrawing.value) return;
  ev.preventDefault();
  isDrawing.value = false;
  try {
    canvasRef.value?.releasePointerCapture(ev.pointerId);
  } catch {
    /* ignore */
  }
  const el = canvasRef.value;
  if (el) {
    const { nx, ny } = pointerCanvasCoords(ev, el.getBoundingClientRect());
    scheduleAwareness({ phase: "hover", nx, ny });
  }
  schedulePreview();
  schedulePushStudioToY();
}

function onCanvasPointerLeave() {
  if (isPanning) return;
  if (isDrawing.value) return;
  clearWhiteboardAwareness();
  updateRemoteCursors();
}

function toggleErase() {
  canErase.value = !canErase.value;
  if (canErase.value) {
    canSpray.value = false;
    showSprayPanel.value = false;
    showBrushPanel.value = true;
  }
}

function toggleRain() {
  toolMode.value = "draw";
  canRain.value = !canRain.value;
  if (canRain.value) {
    canSpray.value = false;
    showSprayPanel.value = false;
  }
}

function openBrush() {
  toolMode.value = "draw";
  showBrushPanel.value = !showBrushPanel.value;
  if (showBrushPanel.value) {
    setDrawingTool("freehand");
    canSpray.value = false;
    showSprayPanel.value = false;
  }
}

function toggleBrushPanel() {
  showBrushPanel.value = false;
}

function toggleSpray() {
  toolMode.value = "draw";
  canSpray.value = !canSpray.value;
  if (canSpray.value) {
    showBrushPanel.value = false;
    showSprayPanel.value = true;
    canErase.value = false;
    canRain.value = false;
  } else {
    showSprayPanel.value = false;
  }
}

function clearCanvas() {
  if (!canvasRef.value) return;

  cw = DEFAULT_DOC_W;
  ch = DEFAULT_DOC_H;
  viewPanX.value = 0;
  viewPanY.value = 0;
  viewZoom.value = 1;
  toolMode.value = "draw";
  setDrawingTool("freehand");
  resetShapeDrag();
  canErase.value = false;
  canSpray.value = false;
  canRain.value = false;
  showSprayPanel.value = false;

  try {
    const key = storageKey();
    localStorage.removeItem(`${key}_canvas`);
    localStorage.removeItem(`${key}_draw`);
    localStorage.removeItem(`${key}_bg`);
  } catch {
    /* quota / private mode */
  }

  suppressResizeSnap = true;
  try {
    resizeCanvases();
  } finally {
    suppressResizeSnap = false;
  }

  if (!ctx) return;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cw, ch);
  schedulePreview();
  flushPushStudioToY();
}

function storageKey() {
  return `nonza_studio_${props.roomId ?? "local"}`;
}

function saveCanvas() {
  const d = canvasRef.value;
  if (!d) return;
  try {
    localStorage.setItem(storageKey() + "_canvas", d.toDataURL("image/png"));
  } catch {
    /* quota */
  }
  flushPushStudioToY();
  collab?.persistRoomDocument?.();
}

function loadFromStorage() {
  const d = canvasRef.value;
  const c = ctx;
  if (!d || !c) return;
  const legacyDraw = localStorage.getItem(storageKey() + "_draw");
  const legacyBg = localStorage.getItem(storageKey() + "_bg");
  const merged = localStorage.getItem(storageKey() + "_canvas");
  const dataUrl = merged ?? legacyDraw ?? legacyBg;
  if (!dataUrl) return;
  const img = new Image();
  img.onload = () => {
    c.globalCompositeOperation = "source-over";
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, cw, ch);
    c.drawImage(img, 0, 0, cw, ch);
    schedulePreview();
  };
  img.src = dataUrl;
}

function refreshDownload() {
  flushPreviewNow();
}

function onColorPick() {
  canRain.value = false;
  syncBrushStyle();
}

function updateRemoteCursors() {
  const aw = collab?.awareness.value;
  const c = canvasRef.value;
  if (!aw || !c) {
    remoteCursors.value = [];
    return;
  }
  const r = c.getBoundingClientRect();
  const w = r.width;
  const h = r.height;
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
let viewportRo: ResizeObserver | null = null;

watch(
  () => collab?.awareness.value,
  (aw, prev) => {
    if (prev) prev.off("change", updateRemoteCursors);
    if (aw) aw.on("change", updateRemoteCursors);
    updateRemoteCursors();
  },
  { immediate: true },
);

watch([showNavPanel, showBrushPanel, showSprayPanel], () => {
  void nextTick(() => clampAllPanels());
});

onMounted(() => {
  syncBrushStyle();
  resizeCanvases();
  loadFromStorage();
  const frame = stageFrameRef.value;
  if (frame && typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => scheduleResizeCanvases());
    ro.observe(frame);
  }
  const vp = viewportRef.value;
  if (vp && typeof ResizeObserver !== "undefined") {
    viewportRo = new ResizeObserver(() => clampAllPanels());
    viewportRo.observe(vp);
  }
  void nextTick(() => clampAllPanels());
  window.addEventListener("pointermove", onDragPointerMove);
  window.addEventListener("pointerup", onDragPointerUp);
  window.addEventListener("pointercancel", onDragPointerUp);
});

onBeforeUnmount(() => {
  if (persistTimer !== null) window.clearTimeout(persistTimer);
  unbindStudioMap?.();
  unbindStudioMap = null;
  flushPushStudioToY();
  collab?.persistRoomDocument?.();

  ro?.disconnect();
  ro = null;
  viewportRo?.disconnect();
  viewportRo = null;
  window.removeEventListener("pointermove", onDragPointerMove);
  window.removeEventListener("pointerup", onDragPointerUp);
  window.removeEventListener("pointercancel", onDragPointerUp);
  if (rafAware) cancelAnimationFrame(rafAware);
  if (previewDebounceTimer !== null) {
    clearTimeout(previewDebounceTimer);
    previewDebounceTimer = null;
  }
  if (resizeDebounceTimer !== null) {
    clearTimeout(resizeDebounceTimer);
    resizeDebounceTimer = null;
  }
  collab?.awareness.value?.off("change", updateRemoteCursors);
  clearWhiteboardAwareness();
});
</script>

<style scoped>
.studio {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 240px;
  background: transparent;
  overflow: hidden;
  user-select: none;
}

.studio__viewport {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #626262;
}

.studio__stage-frame {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  box-sizing: border-box;
  overflow: auto;
}

.studio__view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  will-change: transform;
  transform-origin: 0 0;
}

.studio__expand-wrap {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  box-sizing: border-box;
}

.studio__expand-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
}

.studio__expand--edge {
  border: 1px solid transparent;
  border-radius: 5px;
  background: #535353;
  color: #dcdcdc;
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  transition:
    background 0.2s linear,
    border-color 0.2s linear;
}

.studio__expand--edge:hover {
  background: #383838;
  border-color: #636363;
}

.studio__expand--top,
.studio__expand--bottom {
  width: 36px;
  height: 28px;
}

.studio__expand--left,
.studio__expand--right {
  width: 28px;
  height: 36px;
}

.studio__stage {
  position: relative;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  background: #ffffff;
}

.studio__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
}

.studio__canvas--draw {
  cursor: crosshair;
}

.studio__canvas--grab {
  cursor: grab;
}

.studio__canvas--grab:active {
  cursor: grabbing;
}

.studio__canvas--fill {
  cursor: cell;
}

.studio__canvas--text {
  cursor: text;
}

.studio__canvas--crosshair {
  cursor: crosshair;
}

.studio__text-layer {
  position: fixed;
  inset: 0;
  z-index: 20000;
}

.studio__text-pop {
  position: fixed;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: #2a2a2a;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}

.studio__text-field {
  width: min(280px, 70vw);
  padding: 6px 8px;
  font-size: 14px;
  border: 1px solid #555;
  border-radius: 4px;
  background: #fff;
  color: #111;
}

.studio__text-ok {
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  border: none;
  border-radius: 4px;
  background: #4a9eff;
  color: #fff;
  cursor: pointer;
}

.studio__text-ok:hover {
  background: #3a8eef;
}

.studio__cursors {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  overflow: hidden;
}

.studio__cursor {
  position: absolute;
  left: 0;
  top: 0;
  width: 12px;
  height: 12px;
  border: 2px solid #fff;
  border-radius: 50%;
  pointer-events: none;
  will-change: transform;
}

.studio__cursor-label {
  position: absolute;
  left: 10px;
  top: -20px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

.studio__panel {
  position: absolute;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 0;
  width: 266.6px;
  background: #535353;
  border-radius: 5px;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.12),
    0 1px 2px rgba(0, 0, 0, 0.24);
  cursor: move;
  overflow: hidden;
}

.studio__panel--nav {
  min-height: 180px;
}

.studio__panel--nav .studio__panel-body {
  flex: 1;
  justify-content: center;
  align-items: center;
}

.studio__panel--brush,
.studio__panel--spray {
  min-height: 100px;
}

.studio__panel-head {
  flex-shrink: 0;
  height: 20px;
  background: #434343;
  border-radius: 5px 5px 0 0;
  display: flex;
  align-items: center;
  padding-left: 5px;
  font-size: 10px;
  color: #dcdcdc;
}

.studio__panel-body {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 10px 12px 12px;
  min-height: 0;
}

.studio__cross {
  cursor: pointer;
  margin-left: auto;
  padding: 0 8px;
  font-size: 14px;
  line-height: 1;
  background: none;
  border: none;
  color: inherit;
}

.studio__thumb {
  width: 250px;
  max-width: 100%;
  height: auto;
  aspect-ratio: 250 / 133.33;
  object-fit: contain;
  border-radius: 5px;
  background: #222;
}

.studio__label {
  font-size: 11px;
  font-weight: 700;
  color: #dcdcdc;
}

.studio__range {
  width: 100%;
  max-width: 200px;
}

.studio__size-preview-wrap {
  display: flex;
  justify-content: center;
  padding: 4px 0;
}

.studio__size-preview {
  display: block;
  border-radius: 50%;
  border: 1px solid #383838;
}

.studio__toolbar {
  position: absolute;
  z-index: 11;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 50px;
  background: #535353;
  border-radius: 5px 5px 5px 5px;
  box-shadow:
    0 3px 6px rgba(0, 0, 0, 0.16),
    0 3px 6px rgba(0, 0, 0, 0.23);
  cursor: move;
  overflow: hidden;
}

.studio__toolbar-title {
  height: 20px;
  background: #434343;
  color: #dcdcdc;
  font-size: 10px;
  display: flex;
  align-items: center;
  padding-left: 5px;
  border-radius: 5px 5px 0 0;
  flex-shrink: 0;
}

.studio__tool {
  height: 45px;
  width: 100%;
  box-sizing: border-box;
  border: 1px solid transparent;
  border-radius: 5px;
  background: #535353;
  color: #dcdcdc;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.2s linear,
    border-color 0.2s linear;
}

.studio__tool:hover {
  border-radius: 5px;
  background: #383838;
  border-color: #636363;
}

.studio__tool--on {
  background: #383838;
  border-color: #636363;
}

.studio__tool--link {
  text-decoration: none;
  color: #dcdcdc;
}

.studio__tool--link:hover {
  color: #dcdcdc;
}

.studio__color {
  width: 100%;
  height: 36px;
  padding: 4px;
  border: none;
  background: #535353;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  border-radius: 5px;
  outline: none;
}

.studio__color::-webkit-color-swatch-wrapper {
  padding: 2px 1px;
  height: 26px;
  width: 26px;
}

.studio__color::-webkit-color-swatch {
  border: 2px solid #383838;
  border-radius: 5px;
}
</style>
