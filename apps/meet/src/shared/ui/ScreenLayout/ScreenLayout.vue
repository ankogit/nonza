<template>
  <div class="screen-layout full-page" :class="containerClass">
    <div class="screen-layout__container">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    narrow?: boolean;
    centered?: boolean;
  }>(),
  { narrow: false, centered: true },
);

const containerClass = computed(() => ({
  "screen-layout--narrow": props.narrow,
  "screen-layout--centered": props.centered,
}));
</script>

<style scoped>
.screen-layout {
  padding: 24px;
  box-sizing: border-box;
}

.screen-layout:not(.screen-layout--narrow) {
  min-height: 100%;
}

.screen-layout__container {
  max-width: 900px;
  margin: 0 auto;
}

.screen-layout--narrow .screen-layout__container {
  max-width: 500px;
}

.screen-layout--centered .screen-layout__container {
  margin-left: auto;
  margin-right: auto;
}

@media (max-width: 360px) {
  .screen-layout {
    padding: 12px;
  }
}
</style>
