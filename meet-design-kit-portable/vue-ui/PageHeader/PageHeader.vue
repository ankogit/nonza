<template>
  <div class="page-header">
    <div class="page-header__main">
      <h1 class="page-header__title">{{ title }}</h1>
      <p v-if="subtitle" class="page-header__subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.action" class="page-header__action">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.page-header__main {
  min-width: 0;
}

.page-header__title {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
  color: #fff;
  font-family: "Bebas Neue", sans-serif;
  letter-spacing: 0.02em;
}

.page-header__subtitle {
  margin: 4px 0 0 0;
  font-size: 14px;
  color: #999;
}

.page-header__action {
  flex-shrink: 0;
}
</style>
