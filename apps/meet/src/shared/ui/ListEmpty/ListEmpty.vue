<template>
  <div class="list-empty">
    <p class="list-empty__message">{{ message }}</p>
    <slot name="action" />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    message?: string;
  }>(),
  { message: "Нет данных" },
);
</script>

<style scoped>
.list-empty {
  padding: 48px 24px;
  text-align: center;
  color: #999;
}

.list-empty__message {
  margin: 0 0 16px 0;
  font-size: 16px;
}
</style>
