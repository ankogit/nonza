<template>
  <label
    class="pixel-switch"
    :class="{ 'pixel-switch--disabled': disabled }"
  >
    <input
      :id="id"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      :aria-label="ariaLabel"
      class="pixel-switch__input"
      @change="onChange"
    />
    <span class="pixel-switch__track" aria-hidden="true">
      <span class="pixel-switch__thumb" />
    </span>
    <span v-if="$slots.default" class="pixel-switch__label">
      <slot />
    </span>
  </label>
</template>

<script setup lang="ts">
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
.pixel-switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.pixel-switch--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pixel-switch__input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.pixel-switch__track {
  width: 48px;
  height: 26px;
  flex-shrink: 0;
  border: 3px solid #444;
  background: #333;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  padding: 2px;
}

.pixel-switch__thumb {
  width: 18px;
  height: 18px;
  background: #666;
  transition: transform 0.15s ease;
}

.pixel-switch__input:checked + .pixel-switch__track {
  background: #2980b9;
  border-color: #3a91c9;
}

.pixel-switch__input:checked + .pixel-switch__track .pixel-switch__thumb {
  background: #fff;
  transform: translateX(22px);
}

.pixel-switch__input:focus-visible + .pixel-switch__track {
  border-color: #2980b9;
  box-shadow:
    2px 2px 0 0 rgba(0, 0, 0, 0.3),
    inset 0 0 0 2px #2980b9;
}

.pixel-switch__label {
  font-size: 14px;
  color: #bab1a8;
}
</style>
