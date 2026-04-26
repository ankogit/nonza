<template>
  <span
    class="pixel-badge"
    :class="[
      `pixel-badge--${variant}`,
      { 'pixel-badge--small': size === 'small' },
    ]"
  >
    <slot />
  </span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "default" | "primary" | "danger" | "warning" | "success";
    size?: "small" | "medium";
  }>(),
  {
    variant: "default",
    size: "medium",
  },
);
</script>

<style scoped>
.pixel-badge {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  font-size: 13px;
  font-weight: 600;
  border: 3px solid;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.3);
  font-family: inherit;
}

.pixel-badge--small {
  padding: 3px 8px;
  font-size: 11px;
  border-width: 2px;
  box-shadow: 1px 1px 0 0 rgba(0, 0, 0, 0.3);
}

.pixel-badge--default {
  background: #3a3a3a;
  border-color: #505050;
  color: #f2efe6;
}

.pixel-badge--primary {
  background: #3498db;
  border-color: #2a7fbd;
  color: #f0f7ff;
}

.pixel-badge--danger {
  background: #dc4c45;
  border-color: #c0392b;
  color: #fff5f3;
}

.pixel-badge--warning {
  background: var(--color-warning);
  border-color: #00000020;
  color: var(--color-text);
}

.pixel-badge--success {
  background: #27ae60;
  border-color: #219a52;
  color: #f0fdf4;
}
</style>
