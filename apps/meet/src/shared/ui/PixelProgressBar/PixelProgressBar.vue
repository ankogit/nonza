<template>
  <div
    class="pixel-progress"
    role="progressbar"
    :aria-valuemin="0"
    :aria-valuemax="100"
    :aria-valuenow="indeterminate ? undefined : clampedValue"
    :aria-busy="indeterminate"
    :aria-label="ariaLabel"
  >
    <p v-if="statusText" class="pixel-progress__status">{{ statusText }}</p>
    <div class="pixel-progress__track">
      <span
        v-for="index in segmentCount"
        :key="index"
        class="pixel-progress__segment"
        :class="segmentClass(index - 1)"
      />
    </div>
    <p v-if="counterText" class="pixel-progress__counter font-bebas">
      {{ counterText }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    value?: number;
    done?: number;
    total?: number;
    segmentCount?: number;
    indeterminate?: boolean;
    statusText?: string;
    ariaLabel?: string;
  }>(),
  {
    value: 0,
    segmentCount: 12,
    indeterminate: false,
    ariaLabel: "Прогресс загрузки",
  },
);

const clampedValue = computed(() =>
  Math.min(100, Math.max(0, Math.round(props.value))),
);

const filledSegmentCount = computed(() => {
  if (props.indeterminate) return 0;
  const count = Math.max(1, props.segmentCount);
  return Math.round((clampedValue.value / 100) * count);
});

const counterText = computed(() => {
  if (props.indeterminate) return "";
  const total = props.total ?? 0;
  if (total <= 0) return "";
  const done = Math.min(props.done ?? 0, total);
  return `${done} / ${total}`;
});

function segmentClass(index: number): Record<string, boolean> {
  if (props.indeterminate) {
    return { "pixel-progress__segment--pulse": true };
  }
  return { "pixel-progress__segment--filled": index < filledSegmentCount.value };
}
</script>

<style scoped>
.pixel-progress {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  min-width: 140px;
  max-width: 220px;
}

.pixel-progress__status {
  margin: 0;
  font-family: "Open Sans", sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
  text-align: center;
}

.pixel-progress__track {
  display: flex;
  gap: 3px;
  padding: 4px;
  border: 3px solid #444;
  border-top-color: #555;
  border-left-color: #555;
  background: #1a1a1a;
  box-shadow:
    inset 2px 2px 0 rgba(0, 0, 0, 0.45),
    3px 3px 0 rgba(0, 0, 0, 0.35);
}

.pixel-progress__segment {
  flex: 1;
  height: 14px;
  min-width: 0;
  background: #2a2a2a;
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.35);
  transition: background-color 0.08s steps(1);
}

.pixel-progress__segment--filled {
  background: #2980b9;
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.18),
    inset 0 -2px 0 rgba(0, 0, 0, 0.25);
}

.pixel-progress__segment--pulse {
  animation: pixel-progress-pulse 1.1s steps(12) infinite;
  animation-delay: calc(var(--seg-i, 0) * -0.08s);
}

.pixel-progress__segment--pulse:nth-child(1) {
  --seg-i: 0;
}
.pixel-progress__segment--pulse:nth-child(2) {
  --seg-i: 1;
}
.pixel-progress__segment--pulse:nth-child(3) {
  --seg-i: 2;
}
.pixel-progress__segment--pulse:nth-child(4) {
  --seg-i: 3;
}
.pixel-progress__segment--pulse:nth-child(5) {
  --seg-i: 4;
}
.pixel-progress__segment--pulse:nth-child(6) {
  --seg-i: 5;
}
.pixel-progress__segment--pulse:nth-child(7) {
  --seg-i: 6;
}
.pixel-progress__segment--pulse:nth-child(8) {
  --seg-i: 7;
}
.pixel-progress__segment--pulse:nth-child(9) {
  --seg-i: 8;
}
.pixel-progress__segment--pulse:nth-child(10) {
  --seg-i: 9;
}
.pixel-progress__segment--pulse:nth-child(11) {
  --seg-i: 10;
}
.pixel-progress__segment--pulse:nth-child(12) {
  --seg-i: 11;
}

@keyframes pixel-progress-pulse {
  0%,
  100% {
    background: #2a2a2a;
    box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.35);
  }
  50% {
    background: #2980b9;
    box-shadow:
      inset 0 2px 0 rgba(255, 255, 255, 0.18),
      inset 0 -2px 0 rgba(0, 0, 0, 0.25);
  }
}

.pixel-progress__counter {
  margin: 0;
  font-size: 22px;
  line-height: 1;
  letter-spacing: 0.06em;
  color: #fff;
  text-align: center;
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.45);
}
</style>
