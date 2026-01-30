<template>
  <div
    v-if="state.isSupported"
    class="e2ee-indicator"
    :class="{
      'e2ee-indicator--active': state.isActive,
      'e2ee-indicator--inactive': state.isEnabled && !state.isActive,
      'e2ee-indicator--unavailable': !state.isEnabled,
    }"
    :title="tooltip"
  >
    <span class="e2ee-indicator__icon" aria-hidden="true">
      {{ state.isActive ? "🔒" : "🔓" }}
    </span>
    <span v-if="showLabel" class="e2ee-indicator__label">E2EE</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useE2EE } from "../lib/useE2EE";
import type { Room } from "livekit-client";

const props = withDefaults(
  defineProps<{
    room: Room | null;
    showLabel?: boolean;
  }>(),
  { showLabel: false },
);

const { state } = useE2EE(() => props.room);

const tooltip = computed(() => {
  if (state.value.isActive) return "End-to-End шифрование включено";
  if (state.value.isEnabled) return "End-to-End шифрование выключено";
  return "Шифрование недоступно в этой комнате";
});
</script>

<style scoped>
.e2ee-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  border: 2px solid rgba(0, 0, 0, 0.125);
  font-size: 12px;
  line-height: 1;
  user-select: none;
}

.e2ee-indicator--active {
  background: #0ead61;
  color: #fff;
}

.e2ee-indicator--inactive {
  background: #333;
  color: #999;
}

.e2ee-indicator--unavailable {
  background: #2a2a2a;
  color: #666;
}

.e2ee-indicator__icon {
  font-size: 14px;
}

.e2ee-indicator__label {
  font-weight: 600;
  letter-spacing: 0.02em;
}
</style>
