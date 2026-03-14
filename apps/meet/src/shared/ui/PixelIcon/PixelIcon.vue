<template>
  <i :class="iconClass" :style="iconStyle" aria-hidden="true" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { pixelIconClass, type PixelIconName } from "./icons";

const props = withDefaults(
  defineProps<{
    name: PixelIconName;
    variant?: "small" | "large";
    size?: number | string;
  }>(),
  { variant: undefined, size: undefined }
);

const iconClass = computed(() => {
  const base = pixelIconClass(props.name);
  if (props.size != null) return base;
  if (props.variant === "small") return `${base} pi--small`;
  if (props.variant === "large") return `${base} pi--large`;
  return base;
});

const iconStyle = computed(() => {
  if (props.size == null) return undefined;
  const value = typeof props.size === "number" ? `${props.size}px` : props.size;
  return { "--pi-size": value } as Record<string, string>;
});
</script>
