<template>
  <div class="knob-control" :class="{ 'knob-control--compact': compact }">
    <div
      class="knob-control__wrap"
      :class="[
        `knob-control__wrap--${color}`,
        { 'knob-control__wrap--active': dragging },
      ]"
      :style="{ width: `${displaySize}px`, height: `${displaySize}px` }"
      @pointerdown="startDrag"
    >
      <div class="knob-control__body" :style="{ transform: `rotate(${rotationDeg}deg)` }">
        <div class="knob-control__handle" />
      </div>
    </div>

    <div v-if="label" class="knob-control__label">{{ label }}</div>
    <div class="knob-control__value">{{ displayValue }}</div>

    <div v-if="dragging && overlayPos" class="knob-control__overlay">
      <div
        class="knob-control__line knob-control__line--beam"
        :style="beamStyle"
      />
      <div
        class="knob-control__line knob-control__line--stem"
        :style="stemStyle"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

const BASE_HEIGHT = 100;

const props = withDefaults(
  defineProps<{
    modelValue: number;
    min: number;
    max: number;
    step?: number;
    size?: number;
    bufferSize?: number;
    label?: string;
    formatValue?: (value: number) => string;
    color?: "blue" | "orange" | "red";
    /** Smaller diameter, thinner rim and handle */
    compact?: boolean;
  }>(),
  {
    step: 1,
    size: 64,
    bufferSize: 300,
    label: "",
    formatValue: undefined,
    color: "blue",
    compact: false,
  },
);

const displaySize = computed(() =>
  props.compact ? Math.min(props.size, 32) : props.size,
);

const sweepDeg = computed(() =>
  props.compact ? Math.min(props.bufferSize, 260) : props.bufferSize,
);

const emit = defineEmits<{
  "update:modelValue": [value: number];
}>();

type OverlayPos = {
  top: number;
  scale: number;
  knobCenter: [number, number];
  cursor: [number, number];
};

const dragging = ref(false);
const overlayPos = ref<OverlayPos | null>(null);

const normalized = computed(() => {
  if (props.max === props.min) return 0;
  return Math.max(0, Math.min(1, (props.modelValue - props.min) / (props.max - props.min)));
});

const rotationDeg = computed(
  () => normalized.value * sweepDeg.value - sweepDeg.value / 2,
);

const displayValue = computed(() => {
  if (props.formatValue) return props.formatValue(props.modelValue);
  return String(props.modelValue);
});

const stemStyle = computed(() => {
  if (!overlayPos.value) return {};
  const p = overlayPos.value;
  return {
    transform: `translateX(${p.cursor[0]}px) translateY(${p.top}px) scaleY(${BASE_HEIGHT * p.scale})`,
  };
});

const beamStyle = computed(() => {
  if (!overlayPos.value) return {};
  const p = overlayPos.value;
  const [x1, y1] = p.knobCenter;
  const [x2, y2] = p.cursor;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const degrees = (Math.atan2(dy, dx) * 180) / Math.PI;
  return {
    transform: `translateX(${x1}px) translateY(${y1}px) rotate(${degrees}deg) scaleX(${distance})`,
  };
});

function clamp(v: number) {
  return Math.max(props.min, Math.min(props.max, v));
}

function snap(v: number) {
  const snapped = Math.round(v / props.step) * props.step;
  return clamp(snapped);
}

function onMove(e: PointerEvent) {
  if (!overlayPos.value) return;
  e.preventDefault();

  const x = e.clientX;
  const y = e.clientY;
  const center = overlayPos.value.knobCenter;
  const scale = Math.abs(x - center[0]) / 200 + 1;

  let top = overlayPos.value.top;
  if (y < top) top = y;
  if (y > top + BASE_HEIGHT * scale) top = y - BASE_HEIGHT * scale;

  const normalizedValue = (100 - (y - top) * (100 / (BASE_HEIGHT * scale))) / 100;
  const unnormalized = snap(props.min + normalizedValue * (props.max - props.min));
  overlayPos.value = { top, scale, knobCenter: center, cursor: [x, y] };

  if (unnormalized !== props.modelValue) {
    emit("update:modelValue", unnormalized);
  }
}

function stopDrag() {
  dragging.value = false;
  overlayPos.value = null;
  window.removeEventListener("pointermove", onMove);
  window.removeEventListener("pointerup", stopDrag);
}

function startDrag(e: PointerEvent) {
  e.preventDefault();
  const el = e.currentTarget as HTMLElement;
  const rect = el.getBoundingClientRect();
  const center: [number, number] = [rect.left + rect.width / 2, rect.top + rect.height / 2];
  const scale = Math.abs(e.clientX - center[0]) / 200 + 1;
  const top = e.clientY - (BASE_HEIGHT * scale - normalized.value * (BASE_HEIGHT * scale));

  dragging.value = true;
  overlayPos.value = {
    top,
    scale,
    knobCenter: center,
    cursor: [e.clientX, e.clientY],
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", stopDrag);
}
</script>

<style scoped>
.knob-control {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.knob-control--compact .knob-control__wrap {
  border-width: 2px;
  box-shadow: 1px 1px 0 rgba(0, 0, 0, 0.35);
}

.knob-control--compact .knob-control__handle {
  width: 4px;
  height: 11px;
  top: -2px;
}

.knob-control--compact .knob-control__label,
.knob-control--compact .knob-control__value {
  font-size: 10px;
}

.knob-control__wrap {
  border: 3px solid #333;
  border-top-color: #444;
  border-left-color: #444;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.35);
  background: var(--knob-bg, #457fb3);
  cursor: ns-resize;
  display: grid;
  place-items: center;
  border-radius: 999px;
  overflow: hidden;
}

.knob-control__wrap--active {
  background: var(--knob-bg-active, #5a8fc4);
}

.knob-control__wrap--blue {
  --knob-bg: #457fb3;
  --knob-bg-active: #5a8fc4;
}

.knob-control__wrap--orange {
  --knob-bg: #f37d02;
  --knob-bg-active: #ff9733;
}

.knob-control__wrap--red {
  --knob-bg: #c7463d;
  --knob-bg-active: #df5f55;
}

.knob-control__body {
  width: 100%;
  height: 100%;
  position: relative;
  border-radius: 999px;
}

.knob-control__handle {
  position: absolute;
  width: 6px;
  height: 18px;
  background: #111;
  left: 50%;
  top: -3px;
  transform: translateX(-50%);
}

.knob-control__label {
  color: #bab1a8;
  font-size: 12px;
}

.knob-control__value {
  color: #fff;
  font-size: 12px;
}

.knob-control__overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  pointer-events: none;
}

.knob-control__line {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  background: rgba(255, 255, 255, 0.7);
  transform-origin: left center;
}

.knob-control__line--stem {
  transform-origin: center top;
}
</style>

