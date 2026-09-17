<template>
  <Button
    :variant="unpinHover ? 'danger' : 'default'"
    class="call-menu-palette-opener"
    :title="unpinHover ? unpinTitle : title"
    aria-label="Виджеты"
    :aria-expanded="paletteOpen"
    @click="emit('click')"
    @dragover="emit('dragover', $event)"
    @dragleave="emit('dragleave', $event)"
    @drop="emit('drop', $event)"
  >
    <PixelIcon :name="unpinHover ? 'delete' : 'burger'" variant="large" />
  </Button>
</template>

<script setup lang="ts">
import { Button, PixelIcon } from "@shared/ui";

defineProps<{
  title: string;
  unpinTitle: string;
  paletteOpen: boolean;
  unpinHover: boolean;
}>();

const emit = defineEmits<{
  click: [];
  dragover: [ev: DragEvent];
  dragleave: [ev: DragEvent];
  drop: [ev: DragEvent];
}>();
</script>

<style scoped>
.call-menu-palette-opener {
  flex-shrink: 0;
  width: 48px !important;
  height: 48px !important;
  min-width: 48px !important;
  min-height: 48px !important;
  align-self: center;
}

@media (max-width: 768px) {
  .call-menu-palette-opener {
    width: 44px !important;
    height: 44px !important;
    min-width: 44px !important;
    min-height: 44px !important;
  }
}

@media (max-width: 480px) {
  .call-menu-palette-opener {
    width: 42px !important;
    height: 42px !important;
    min-width: 42px !important;
    min-height: 42px !important;
  }
}
</style>
