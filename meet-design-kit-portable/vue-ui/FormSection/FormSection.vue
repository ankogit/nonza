<template>
  <div class="form-section">
    <label v-if="label" class="form-section__label">{{ label }}</label>
    <p v-if="hint" class="form-section__hint">{{ hint }}</p>
    <div class="form-section__field">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label?: string;
  hint?: string;
}>();
</script>

<style scoped>
.form-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-section__label {
  font-size: 14px;
  font-weight: 600;
  color: #ccc;
}

.form-section__hint {
  margin: 0;
  font-size: 13px;
  color: #999;
}
</style>