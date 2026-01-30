<template>
  <div
    class="pixel-alert"
    :class="[`pixel-alert--${variant}`, { 'pixel-alert--dismissible': dismissible }]"
    role="alert"
  >
    <span v-if="$slots.title" class="pixel-alert__title">
      <slot name="title" />
    </span>
    <span class="pixel-alert__content">
      <slot />
    </span>
    <button
      v-if="dismissible"
      type="button"
      class="pixel-alert__close"
      aria-label="Закрыть"
      @click="emit('close')"
    >
      ✕
    </button>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "info" | "success" | "warning" | "danger";
    dismissible?: boolean;
  }>(),
  {
    variant: "info",
    dismissible: false,
  },
);

const emit = defineEmits<{
  close: [];
}>();
</script>

<style scoped>
.pixel-alert {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border: 3px solid;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.3);
  font-size: 14px;
}

.pixel-alert--dismissible {
  padding-right: 40px;
  position: relative;
}

.pixel-alert__title {
  font-weight: 700;
  flex-shrink: 0;
}

.pixel-alert__content {
  flex: 1;
  min-width: 0;
}

.pixel-alert__close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 2px solid currentColor;
  background: transparent;
  color: inherit;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
}

.pixel-alert__close:hover {
  opacity: 1;
}

.pixel-alert--info {
  background: #1a2a3a;
  border-color: #2980b9;
  color: #bab1a8;
}

.pixel-alert--success {
  background: #1a2a1a;
  border-color: #0ead61;
  color: #bab1a8;
}

.pixel-alert--warning {
  background: #2a2a1a;
  border-color: #ffbe53;
  color: #bab1a8;
}

.pixel-alert--danger {
  background: #2a1a1a;
  border-color: #e2534b;
  color: #bab1a8;
}
</style>
