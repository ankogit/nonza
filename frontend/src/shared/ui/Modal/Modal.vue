<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="modal-overlay"
        @click.self="handleOverlayClick"
      >
        <div class="modal-container">
          <div class="modal-header" v-if="title || $slots.header">
            <h2 v-if="title" class="modal-title">{{ title }}</h2>
            <slot name="header" />
            <button
              type="button"
              class="modal-close"
              title="Закрыть"
              aria-label="Закрыть"
              @click="handleClose"
            >
              ✕
            </button>
          </div>
          <div class="modal-content">
            <slot />
          </div>
          <div class="modal-footer" v-if="$slots.footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, onUnmounted } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    closeOnOverlayClick?: boolean;
  }>(),
  {
    closeOnOverlayClick: true,
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
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
  padding: 20px;
}

.modal-container {
  background: #1f1f1f;
  border: 3px solid #444;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.5), 8px 8px 0 0 rgba(0, 0, 0, 0.3);
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 320px;
  width: 100%;
  max-width: 500px;
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

.modal-close {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 2px solid #444;
  background: #333;
  color: #bab1a8;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: none;
  filter: drop-shadow(1px 1px 0px rgba(0, 0, 0, 0.25));
}

.modal-close:hover {
  background: #444;
  border-color: #555;
}

.modal-close:active {
  background: #222;
  box-shadow: inset 0 0 0 2px #2980b9;
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
  transition: transform 0.2s ease, opacity 0.2s ease;
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
