<template>
  <Button
    :variant="unpinHover ? 'danger' : 'default'"
    size="small"
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
}
</style>
