<template>
  <div
    class="pixel-toast"
    :class="[`pixel-toast--${variant}`]"
    role="status"
    aria-live="polite"
  >
    <div v-if="icon" class="pixel-toast__icon-wrap">
      <PixelIcon :name="(icon as PixelIconName)" variant="small" />
    </div>
    <span class="pixel-toast__message">{{ message }}</span>
    <Button
      type="icon"
      size="small"
      variant="default"
      class="pixel-toast__close"
      aria-label="Закрыть"
      @click="$emit('dismiss')"
    >
      <PixelIcon name="close" variant="small" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Button, PixelIcon, type PixelIconName } from "@shared/ui";
import type { ToastVariant } from "@shared/lib";

defineProps<{
  message: string;
  variant?: ToastVariant;
  icon?: string;
}>();

defineEmits<{
  dismiss: [];
}>();
</script>

<style scoped>
.pixel-toast {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  min-width: 220px;
  max-width: 380px;
  border: 3px solid;
  border-radius: 0;
  box-shadow:
    2px 2px 0 0 rgba(0, 0, 0, 0.25),
    0 6px 20px rgba(0, 0, 0, 0.35);
  font-size: 14px;
  line-height: 1.4;
  color: #bab1a8;
}

.pixel-toast__icon-wrap {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.2);
}

.pixel-toast__message {
  flex: 1;
  min-width: 0;
}

.pixel-toast__close {
  flex-shrink: 0;
}

.pixel-toast--default {
  background: #1e1e1e;
  border-color: #444;
}

.pixel-toast--success {
  background: #1a2a1a;
  border-color: #0ead61;
}

.pixel-toast--success .pixel-toast__icon-wrap {
  border-color: rgba(14, 173, 97, 0.4);
  background: rgba(14, 173, 97, 0.15);
}

.pixel-toast--info {
  background: #1a2a3a;
  border-color: #2980b9;
}

.pixel-toast--info .pixel-toast__icon-wrap {
  border-color: rgba(41, 128, 185, 0.4);
  background: rgba(41, 128, 185, 0.15);
}

.pixel-toast--warning {
  background: #2a2a1a;
  border-color: #ffc866;
}

.pixel-toast--warning .pixel-toast__icon-wrap {
  border-color: rgba(255, 200, 102, 0.4);
  background: rgba(255, 200, 102, 0.12);
}

.pixel-toast--danger {
  background: #2a1a1a;
  border-color: #e2534b;
}

.pixel-toast--danger .pixel-toast__icon-wrap {
  border-color: rgba(226, 83, 75, 0.4);
  background: rgba(226, 83, 75, 0.15);
}
</style>
