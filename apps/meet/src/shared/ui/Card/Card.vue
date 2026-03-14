<template>
  <div class="pixel-card" :class="{ 'pixel-card--bordered': bordered }">
    <div v-if="$slots.header" class="pixel-card__header">
      <slot name="header" />
    </div>
    <div class="pixel-card__body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="pixel-card__footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    bordered?: boolean;
  }>(),
  {
    bordered: true,
  },
);
</script>

<style scoped>
.pixel-card {
  background: #1f1f1f;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pixel-card--bordered {
  border: 3px solid #333;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.3);
}

.pixel-card__header {
  padding: 16px 20px;
  border-bottom: 2px solid #333;
  background: #2a2a2a;
  font-weight: 600;
  color: #bab1a8;
}

.pixel-card__body {
  padding: 20px;
  flex: 1;
  color: #bab1a8;
}

.pixel-card__footer {
  padding: 16px 20px;
  border-top: 2px solid #333;
  background: #2a2a2a;
}
</style>
