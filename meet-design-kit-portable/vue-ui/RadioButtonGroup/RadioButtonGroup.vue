<template>
  <div class="radio-button-group" role="radiogroup" :aria-label="ariaLabel">
    <button
      v-for="opt in options"
      :key="String(opt.value)"
      type="button"
      role="radio"
      :aria-checked="modelValue === opt.value"
      :class="[
        'radio-button-group__btn',
        { 'radio-button-group__btn--active': modelValue === opt.value },
      ]"
      @click="emit('update:modelValue', opt.value)"
    >
      <PixelIcon
        v-if="opt.icon"
        :name="opt.icon"
        variant="small"
        class="radio-button-group__icon"
      />
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { PixelIcon } from "@shared/ui";
import type { PixelIconName } from "@shared/ui";

export interface RadioButtonOption {
  value: string;
  label: string;
  icon?: PixelIconName;
}

defineProps<{
  modelValue: string;
  options: RadioButtonOption[];
  ariaLabel?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>

<style scoped>
.radio-button-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.radio-button-group__btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 3px solid #ffffff10;
  border-top: 3px solid #ffffff20;
  border-left: 3px solid #ffffff20;
  background: #333333;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  filter: drop-shadow(2px 2px 0px rgba(0, 0, 0, 0.25));
  transition:
    scale 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.radio-button-group__btn:hover {
  scale: 1.05;
  background-color: #444444;
}

.radio-button-group__btn--active {
  background: #2980b9;
  border-color: #ffffff20;
}

.radio-button-group__btn--active:hover {
  background-color: #3a91c9;
}

.radio-button-group__icon {
  flex-shrink: 0;
}
</style>
