<template>
  <component
    :is="tag"
    :class="['pixel-typography', `pixel-typography--${variant}`]"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    variant?: "h1" | "h2" | "h3" | "body" | "caption" | "label";
  }>(),
  {
    variant: "body",
  },
);

const tag = computed(() => {
  if (["h1", "h2", "h3"].includes(props.variant)) return props.variant;
  return "span";
});
</script>

<style scoped>
.pixel-typography {
  color: #bab1a8;
  font-family: inherit;
}

.pixel-typography--h1 {
  font-family: "Bebas Neue", sans-serif;
  font-size: 2.5rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  line-height: 1.2;
  margin: 0;
}

.pixel-typography--h2 {
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.75rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  line-height: 1.3;
  margin: 0;
}

.pixel-typography--h3 {
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.25rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  line-height: 1.4;
  margin: 0;
}

.pixel-typography--body {
  font-size: 16px;
  line-height: 1.5;
  margin: 0;
}

.pixel-typography--caption {
  font-size: 12px;
  color: #888;
  line-height: 1.4;
  margin: 0;
}

.pixel-typography--label {
  font-size: 14px;
  font-weight: 600;
  color: #ccc;
  margin: 0;
}
</style>
