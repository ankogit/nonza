<template>
  <button
    v-if="trigger"
    type="button"
    :class="classes"
    :title="title"
    :aria-label="ariaLabel"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
  <span
    v-else
    :class="classes"
    :title="title"
    :aria-label="ariaLabel"
  >
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    trigger?: boolean;
    variant?: "success" | "danger" | "warning" | "default";
    title?: string;
    ariaLabel?: string;
    disabled?: boolean;
  }>(),
  {
    trigger: true,
    variant: "default",
  },
);

defineEmits<{
  click: [event: MouseEvent];
}>();

const classes = computed(() => [
  "indicator",
  props.variant,
  ...(props.trigger ? ["indicator--trigger"] : []),
]);
</script>
