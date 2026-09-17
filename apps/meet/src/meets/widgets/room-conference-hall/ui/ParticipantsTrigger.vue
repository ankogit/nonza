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
  border-radius: 0;
  border: 2px solid rgba(0, 0, 0, 0.35);
  background: var(--color-accent, #ffc866);
  color: #1a1a1a;
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 8px;
  font-weight: normal;
  letter-spacing: 0.02em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
