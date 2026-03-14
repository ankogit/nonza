<template>
  <div
    type="button"
    class="button-full-size"
    aria-label="Во весь экран"
    @click="$emit('click')"
  >
    <PixelIcon name="fullscreen" variant="large" />
  </div>
</template>

<script setup lang="ts">
import { PixelIcon } from "@shared/ui";
defineEmits<{ click: [] }>();
</script>

<style scoped>
.button-full-size {
  font-size: 1.25rem;
}
</style>
