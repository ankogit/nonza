<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="modal-overlay"
        :class="{ 'modal-overlay--fullscreen': fullscreen }"
        :aria-label="ariaLabel"
        role="dialog"
        aria-modal="true"
        @click.self="handleOverlayClick"
      >
        <div class="modal-container" :class="{ 'modal-container--fullscreen': fullscreen }">
          <template v-if="!fullscreen">
            <div class="modal-header" v-if="title || $slots.header">
              <h2 v-if="title" class="modal-title">{{ title }}</h2>
              <slot name="header" />
              <Button
                type="icon"
                variant="default"
                :icon-size="'32px'"
                native-type="button"
                title="Закрыть"
                aria-label="Закрыть"
                @click="handleClose"
              >
                ✕
              </Button>
            </div>
            <div class="modal-content">
              <slot />
            </div>
            <div class="modal-footer" v-if="$slots.footer">
              <slot name="footer" />
            </div>
          </template>
          <div v-else class="modal-fullscreen-slot">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, onUnmounted } from "vue";
import { Button } from "@shared/ui";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    closeOnOverlayClick?: boolean;
    fullscreen?: boolean;
    ariaLabel?: string;
  }>(),
  {
    closeOnOverlayClick: true,
    fullscreen: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  close: [];
}>();

const handleClose = () => {
  emit("update:modelValue", false);
  emit("close");
};

const handleOverlayClick = () => {
  if (props.closeOnOverlayClick) {
    handleClose();
  }
};

// Закрытие по Escape
const handleEscape = (e: KeyboardEvent) => {
  if (e.key === "Escape" && props.modelValue) {
    handleClose();
  }
};

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    } else {
      document.removeEventListener("keydown", handleEscape);
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  document.removeEventListener("keydown", handleEscape);
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
  padding: 20px;
}

.modal-overlay--fullscreen {
  padding: 24px;
  align-items: stretch;
  justify-content: stretch;
  background: var(--color-background, #1a1a1a);
  backdrop-filter: none;
}

.modal-container {
  background: #1f1f1f;
  border: 3px solid #444;
  box-shadow:
    4px 4px 0 0 rgba(0, 0, 0, 0.5),
    8px 8px 0 0 rgba(0, 0, 0, 0.3);
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 320px;
  width: 100%;
  max-width: 500px;
}

.modal-container--fullscreen {
  flex: 1;
  min-width: 0;
  min-height: 0;
  max-width: none;
  max-height: none;
  border: none;
  box-shadow: none;
  background: transparent;
}

.modal-fullscreen-slot {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

@media (max-width: 360px) {
  .modal-container:not(.modal-container--fullscreen) {
    min-width: 0;
    width: 100%;
    max-width: calc(100vw - 24px);
  }

  .modal-overlay--fullscreen {
    padding: 12px;
  }

  .modal-header,
  .modal-content,
  .modal-footer {
    padding: 14px;
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 2px solid #333;
  background: #2a2a2a;
  gap: 16px;
}

.modal-title {
  margin: 0;
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.5rem;
  font-weight: 400;
  color: #bab1a8;
  letter-spacing: 0.02em;
  flex: 1;
}

.modal-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  color: #bab1a8;
}

.modal-footer {
  padding: 20px;
  border-top: 2px solid #333;
  background: #2a2a2a;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

/* Анимации */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95);
  opacity: 0;
}
</style>
