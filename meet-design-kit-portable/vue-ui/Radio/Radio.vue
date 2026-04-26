<template>
  <label
    class="pixel-radio"
    :class="{ 'pixel-radio--disabled': disabled }"
  >
    <input
      :id="id"
      type="radio"
      :name="name"
      :value="value"
      :checked="isChecked"
      :disabled="disabled"
      :aria-label="ariaLabel"
      class="pixel-radio__input"
      @change="emit('update:modelValue', value)"
    />
    <span class="pixel-radio__dot" aria-hidden="true" />
    <span v-if="$slots.default" class="pixel-radio__label">
      <slot />
    </span>
  </label>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: string | number;
    value: string | number;
    name?: string;
    disabled?: boolean;
    id?: string;
    ariaLabel?: string;
  }>(),
  {
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string | number];
}>();

const isChecked = computed(() => props.modelValue === props.value);
</script>

<style scoped>
.pixel-radio {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.pixel-radio--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pixel-radio__input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.pixel-radio__dot {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border: 3px solid #444;
  background: #1a1a1a;
  border-radius: 50%;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.3);
}

.pixel-radio__input:focus-visible + .pixel-radio__dot {
  border-color: #2980b9;
  box-shadow:
    2px 2px 0 0 rgba(0, 0, 0, 0.3),
    inset 0 0 0 2px #2980b9;
}

.pixel-radio__input:checked + .pixel-radio__dot {
  background: #2980b9;
  border-color: #3a91c9;
  box-shadow:
    2px 2px 0 0 rgba(0, 0, 0, 0.3),
    inset 0 0 0 4px #1a1a1a;
}

.pixel-radio__label {
  font-size: 14px;
  color: #bab1a8;
}
</style>
