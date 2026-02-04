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
    <span class="pixel-checkbox__box" aria-hidden="true">
      <PixelIcon v-if="modelValue" name="check" :size="14" class="pixel-checkbox__check" />
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
  },
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

.pixel-checkbox__box {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border: 3px solid #444;
  background: #1a1a1a;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.3);
}

.pixel-checkbox__input:focus-visible + .pixel-checkbox__box {
  border-color: #2980b9;
  box-shadow:
    2px 2px 0 0 rgba(0, 0, 0, 0.3),
    inset 0 0 0 2px #2980b9;
}

.pixel-checkbox__input:checked + .pixel-checkbox__box {
  background: #2980b9;
  border-color: #3a91c9;
}

.pixel-checkbox__check {
  color: #fff;
  font-size: 14px;
  font-weight: bold;
  line-height: 1;
}

.pixel-checkbox__label {
  font-size: 14px;
  color: #bab1a8;
}
</style>
