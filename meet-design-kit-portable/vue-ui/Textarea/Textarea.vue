<template>
  <textarea
    :id="id"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :rows="rows"
    :aria-label="ariaLabel"
    :aria-invalid="error ? 'true' : undefined"
    class="pixel-textarea"
    :class="{ 'pixel-textarea--error': error }"
    @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    @blur="emit('blur', $event)"
    @focus="emit('focus', $event)"
  />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    disabled?: boolean;
    readonly?: boolean;
    error?: boolean;
    rows?: number;
    id?: string;
    ariaLabel?: string;
  }>(),
  {
    disabled: false,
    readonly: false,
    error: false,
    rows: 4,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  blur: [event: FocusEvent];
  focus: [event: FocusEvent];
}>();
</script>

<style scoped>
.pixel-textarea {
  width: 100%;
  min-height: 80px;
  padding: 10px 14px;
  border: 3px solid #444;
  background: #1a1a1a;
  color: #bab1a8;
  font-size: 16px;
  font-family: inherit;
  resize: vertical;
  outline: none;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.3);
  transition: none;
}

.pixel-textarea::placeholder {
  color: #666;
}

.pixel-textarea:hover:not(:disabled):not(:readonly) {
  border-color: #555;
  background: #252525;
}

.pixel-textarea:focus {
  border-color: #2980b9;
  box-shadow:
    2px 2px 0 0 rgba(0, 0, 0, 0.3),
    inset 0 0 0 2px #2980b9;
}

.pixel-textarea:disabled,
.pixel-textarea:read-only {
  opacity: 0.6;
  cursor: not-allowed;
}

.pixel-textarea--error {
  border-color: #e2534b;
}

.pixel-textarea--error:focus {
  border-color: #e2534b;
  box-shadow:
    2px 2px 0 0 rgba(0, 0, 0, 0.3),
    inset 0 0 0 2px #e2534b;
}
</style>
