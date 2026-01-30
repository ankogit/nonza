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
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  border: 2px solid;
  box-shadow: 1px 1px 0 0 rgba(0, 0, 0, 0.3);
  font-family: inherit;
}

.pixel-badge--small {
  padding: 2px 6px;
  font-size: 10px;
}

.pixel-badge--default {
  background: #333;
  border-color: #555;
  color: #bab1a8;
}

.pixel-badge--primary {
  background: #2980b9;
  border-color: #3a91c9;
  color: #fff;
}

.pixel-badge--danger {
  background: #e2534b;
  border-color: #f0645a;
  color: #fff;
}

.pixel-badge--warning {
  background: #ffbe53;
  border-color: #ffc866;
  color: #1a1a1a;
}

.pixel-badge--success {
  background: #0ead61;
  border-color: #1fbd71;
  color: #fff;
}
</style>
