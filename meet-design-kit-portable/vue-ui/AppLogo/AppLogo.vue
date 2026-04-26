<template>
  <img
    :src="
      variant === 'withBackground'
        ? '/images/nonza-icon-512.png'
        : '/images/nonza-icon-m.png'
    "
    alt="Nonza"
    class="app-logo"
    :class="[`app-logo--${size}`, { 'app-logo--circle': circle }]"
  />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: "medium" | "compact" | "strip";
    variant?: "default" | "withBackground";
    circle?: boolean;
  }>(),
  { size: "medium", variant: "default", circle: false },
);
</script>

<style scoped>
.app-logo {
  display: block;
  height: auto;
  object-fit: contain;
}

.app-logo--medium {
  max-width: 120px;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
}

.app-logo--compact {
  max-width: 80px;
  width: 100%;
}

.app-logo--strip {
  max-width: 44px;
  max-height: 44px;
  width: 100%;
  height: 100%;
}

.app-logo--circle {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
</style>
