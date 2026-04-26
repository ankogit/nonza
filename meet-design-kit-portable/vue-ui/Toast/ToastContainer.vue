<template>
  <div class="pixel-toast-container" aria-label="Уведомления">
    <TransitionGroup name="toast" tag="div" class="pixel-toast-container__list">
      <Toast
        v-for="item in toasts"
        :key="String(item.id)"
        :message="item.message"
        :variant="item.variant"
        :icon="item.icon"
        @dismiss="dismissToast(item.id)"
      />
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { useToasts, dismissToast } from "@shared/lib";
import Toast from "./Toast.vue";

const { toasts } = useToasts();
</script>

<style scoped>
.pixel-toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 100000;
  pointer-events: none;
}

.pixel-toast-container__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.pixel-toast-container__list :deep(.pixel-toast) {
  pointer-events: auto;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(1rem);
}

.toast-move {
  transition: transform 0.2s ease;
}
</style>
