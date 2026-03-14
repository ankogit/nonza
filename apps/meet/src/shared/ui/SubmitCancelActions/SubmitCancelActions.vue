<template>
  <div class="submit-cancel-actions">
    <button
      type="button"
      class="submit-cancel-actions__btn submit-cancel-actions__btn--secondary"
      :disabled="cancelDisabled"
      @click="$emit('cancel')"
    >
      {{ cancelLabel }}
    </button>
    <button
      type="submit"
      class="submit-cancel-actions__btn submit-cancel-actions__btn--primary"
      :disabled="submitDisabled"
    >
      {{ submitLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    cancelLabel?: string;
    submitLabel?: string;
    submitDisabled?: boolean;
    cancelDisabled?: boolean;
  }>(),
  {
    cancelLabel: "Отмена",
    submitLabel: "Сохранить",
    submitDisabled: false,
    cancelDisabled: false,
  },
);

defineEmits<{
  cancel: [];
}>();
</script>

<style scoped>
.submit-cancel-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 2px solid #444;
}

.submit-cancel-actions__btn {
  padding: 12px 24px;
  border: 2px solid;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: none;
}

.submit-cancel-actions__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.submit-cancel-actions__btn--primary {
  border-color: #2980b9;
  background: #2980b9;
  color: #fff;
}

.submit-cancel-actions__btn--primary:hover:not(:disabled) {
  background: #c0392b;
  border-color: #c0392b;
}

.submit-cancel-actions__btn--secondary {
  border-color: #555;
  background: #333;
  color: #fff;
}

.submit-cancel-actions__btn--secondary:hover:not(:disabled) {
  background: #444;
  border-color: #555;
}
</style>
