<template>
  <label
    class="pixel-checkbox"
    :class="{ 'pixel-checkbox--disabled': disabled }"
  >
    <input
      :id="id"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      :aria-label="ariaLabel"
      class="pixel-checkbox__input"
      @change="onChange"
    />
    <span
      class="check-box"
      :class="{ 'check-box--checked': modelValue }"
      aria-hidden="true"
    >
      <span class="pixel-checkbox__box-inner" :class="{ 'pixel-checkbox__box-inner--visible': modelValue }">
        <PixelIcon name="check" :size="14" />
      </span>
    </span>
    <span v-if="$slots.default" class="pixel-checkbox__label">
      <slot />
    </span>
  </label>
</template>

<script setup lang="ts">
import { PixelIcon } from "@shared/ui";
withDefaults(
  defineProps<{
    modelValue: boolean;
    disabled?: boolean;
    id?: string;
    ariaLabel?: string;
  }>(),
  {
    disabled: false,
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

function onChange(e: Event) {
  emit("update:modelValue", (e.target as HTMLInputElement).checked);
}
</script>

<style scoped>
.pixel-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  height: 24px;
  min-height: 24px;
}

.pixel-checkbox--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pixel-checkbox__input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.pixel-checkbox__box-inner {
  display: block;
  width: 14px;
  height: 14px;
  visibility: hidden;
  line-height: 0;
}

.pixel-checkbox__box-inner--visible {
  visibility: visible;
}

.pixel-checkbox__box-inner :deep(.pi) {
  display: block;
  line-height: 0;
}

.pixel-checkbox__input:focus-visible + .check-box {
  border-color: #2980b9;
  box-shadow: 0 0 0 2px #2980b9;
}

.pixel-checkbox__label {
  font-size: 14px;
  line-height: 24px;
  color: #bab1a8;
}
</style>
