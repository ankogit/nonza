<template>
  <Button
    type="text"
    class="participants-trigger"
    variant="default"
    :title="panelOpen ? 'Скрыть участников' : 'Участники'"
    @click="$emit('toggle')"
  >
    <PixelIcon name="people" variant="small" />
    <span v-if="raisedCount > 0" class="participants-trigger__badge">
      {{ raisedCount }}
    </span>
  </Button>
</template>

<script setup lang="ts">
import { Button, PixelIcon } from "@shared/ui";

defineProps<{
  panelOpen: boolean;
  raisedCount: number;
}>();

defineEmits<{ toggle: [] }>();
</script>

<style scoped>
.participants-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.participants-trigger__badge {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--color-accent, #ffc866);
  color: #1a1a1a;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
