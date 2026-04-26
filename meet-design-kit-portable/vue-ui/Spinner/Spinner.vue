<template>
  <span
    class="pixel-spinner"
    :class="{ 'pixel-spinner--small': size === 'small' }"
    role="status"
    :aria-label="ariaLabel"
  >
    <span class="pixel-spinner__dot" aria-hidden="true" />
  </span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: "small" | "medium";
    ariaLabel?: string;
  }>(),
  {
    size: "medium",
    ariaLabel: "Загрузка",
  },
);
</script>

<style scoped>
.pixel-spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}

.pixel-spinner--small {
  width: 20px;
  height: 20px;
}

.pixel-spinner__dot {
  width: 100%;
  height: 100%;
  border: 3px solid #333;
  border-top-color: #2980b9;
  border-radius: 50%;
  animation: pixel-spinner-spin 0.7s linear infinite;
}

.pixel-spinner--small .pixel-spinner__dot {
  border-width: 2px;
}

@keyframes pixel-spinner-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
