<template>
  <div
    class="skeleton"
    :class="[`skeleton--${variant}`, { 'skeleton--animate': animate }]"
    :style="style"
    role="presentation"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    variant?: "text" | "circle" | "rect";
    width?: string | number;
    height?: string | number;
    animate?: boolean;
  }>(),
  {
    variant: "text",
    animate: true,
  },
);

const style = computed(() => {
  const s: Record<string, string> = {};
  if (props.width !== undefined) {
    s.width = typeof props.width === "number" ? `${props.width}px` : props.width;
  }
  if (props.height !== undefined) {
    s.height =
      typeof props.height === "number" ? `${props.height}px` : props.height;
  }
  return s;
});
</script>

<style scoped>
.skeleton {
  background: rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.skeleton--text {
  height: 1em;
  border-radius: 4px;
  min-width: 2em;
}

.skeleton--circle {
  border-radius: 50%;
  aspect-ratio: 1;
}

.skeleton--rect {
  border-radius: 6px;
  min-width: 24px;
  min-height: 24px;
}

.skeleton--animate {
  overflow: hidden;
}

.skeleton--animate::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.06) 50%,
    transparent 100%
  );
  animation: skeleton-shimmer 1.2s ease-in-out infinite;
}

.skeleton {
  position: relative;
}

@keyframes skeleton-shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
</style>
