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
    class="pixel-input"
    :class="{ 'pixel-input--error': error }"
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
    placeholder?: string;
    disabled?: boolean;
    readonly?: boolean;
    error?: boolean;
    id?: string;
    ariaLabel?: string;
  }>(),
  {
    type: "text",
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
  width: 100%;
  min-height: 44px;
  padding: 10px 14px;
  border: 3px solid #444;
  background: #1a1a1a;
  color: #bab1a8;
  font-size: 16px;
  font-family: inherit;
  outline: none;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.3);
  transition: none;
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
  box-shadow:
    2px 2px 0 0 rgba(0, 0, 0, 0.3),
    inset 0 0 0 2px #2980b9;
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
  box-shadow:
    2px 2px 0 0 rgba(0, 0, 0, 0.3),
    inset 0 0 0 2px #e2534b;
}
</style>
