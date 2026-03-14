<template>
  <div class="pill-group" role="group" :aria-label="ariaLabel">
    <button
      v-for="opt in options"
      :key="String(opt.value)"
      type="button"
      class="pill-group__pill"
      :class="{ 'pill-group__pill--active': modelValue === opt.value }"
      :disabled="disabled"
      :aria-pressed="modelValue === opt.value"
      @click="select(opt)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
export interface PillOption {
  value: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: PillOption[];
    disabled?: boolean;
    ariaLabel?: string;
  }>(),
  {
    disabled: false,
    ariaLabel: "Выберите значение",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

function select(opt: PillOption) {
  if (props.disabled) return;
  emit("update:modelValue", opt.value);
}
</script>

<style scoped>
.pill-group {
  display: inline-flex;
  border: 3px solid #444;
  overflow: hidden;
  background: #252525;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.3);
}

.pill-group__pill {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #999;
  background: transparent;
  border: none;
  border-right: 2px solid #333;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.12s ease, color 0.12s ease;
}

.pill-group__pill:last-child {
  border-right: none;
}

.pill-group__pill:hover:not(:disabled) {
  color: #bab1a8;
  background: rgba(255, 255, 255, 0.06);
}

.pill-group__pill--active {
  color: #fff;
  background: #2980b9;
}

.pill-group__pill:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
