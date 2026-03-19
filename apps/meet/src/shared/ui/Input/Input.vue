<template>
  <input
    :id="id"
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :aria-label="ariaLabel"
    :aria-invalid="error ? 'true' : undefined"
    :autocomplete="autocomplete"
    class="pixel-input"
    :class="[
      `pixel-input--${size}`,
      { 'pixel-input--error': error },
    ]"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    @blur="emit('blur', $event)"
    @focus="emit('focus', $event)"
  />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string;
    type?: "text" | "email" | "password" | "number" | "search";
    size?: "small" | "medium";
    placeholder?: string;
    disabled?: boolean;
    readonly?: boolean;
    error?: boolean;
    id?: string;
    ariaLabel?: string;
    autocomplete?: string;
  }>(),
  {
    type: "text",
    size: "medium",
    disabled: false,
    readonly: false,
    error: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  blur: [event: FocusEvent];
  focus: [event: FocusEvent];
}>();
</script>

<style scoped>
.pixel-input {
  box-sizing: border-box;
  width: 100%;
  height: 48px;
  min-height: 48px;
  padding: 12px;
  border: 3px solid #444;
  border-top-color: #555;
  border-left-color: #555;
  background: #1a1a1a;
  color: #bab1a8;
  font-size: 16px;
  font-family: inherit;
  outline: none;
  filter: drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.25));
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.pixel-input--small {
  height: 36px;
  min-height: 36px;
  padding: 8px 10px;
  font-size: 14px;
}

.pixel-input--medium {
  height: 48px;
  min-height: 48px;
  padding: 12px;
  font-size: 16px;
}

.pixel-input::placeholder {
  color: #666;
}

.pixel-input:hover:not(:disabled):not(:readonly) {
  border-color: #555;
  background: #252525;
}

.pixel-input:focus {
  border-color: #2980b9;
  filter: drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.25));
  box-shadow: inset 0 0 0 2px #2980b9;
}

.pixel-input:disabled,
.pixel-input:read-only {
  opacity: 0.6;
  cursor: not-allowed;
}

.pixel-input--error {
  border-color: #e2534b;
}

.pixel-input--error:focus {
  border-color: #e2534b;
  filter: drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.25));
  box-shadow: inset 0 0 0 2px #e2534b;
}
</style>
