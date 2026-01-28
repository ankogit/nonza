<template>
  <button
    :type="nativeType"
    :class="classes"
    :style="style"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    type?: "icon" | "text";
    variant?:
      | "danger"
      | "warning"
      | "default"
      | "active"
      | "primary"
      | "secondary"
      | "accent";
    size?: "small" | "medium" | "large";
    iconSize?: string; // для кастомного размера иконки, например "48px"
    disabled?: boolean;
    nativeType?: "button" | "submit" | "reset";
  }>(),
  {
    type: "icon",
    size: "medium",
    disabled: false,
    nativeType: "button",
  },
);

const classes = computed(() => {
  const cls: Array<string> = ["button"];

  if (props.type === "text")
    cls.push("button--text", `button--text-${props.size}`);
  if (props.size === "small") cls.push("button--small");
  if (props.variant) cls.push(props.variant);
  if (props.disabled) cls.push("button--disabled");

  return cls;
});

const style = computed(() => {
  if (props.type !== "icon" || !props.iconSize) return undefined;
  return {
    width: props.iconSize,
    height: props.iconSize,
    minWidth: props.iconSize,
    minHeight: props.iconSize,
  } as const;
});

defineEmits<{
  click: [event: MouseEvent];
}>();
</script>

<style scoped>
/* Buttons — стили меню (перенесено из design.css) */
.button {
  box-sizing: border-box;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #457fb3;
  border: 3px solid #ffffff20;
  filter: drop-shadow(2px 2px 0px rgba(0, 0, 0, 0.25));
  transition:
    scale 0.15s ease,
    background-color 0.15s ease;
  cursor: pointer;
  color: inherit;
  font: inherit;
}

.button:hover:not(.button--disabled) {
  scale: 1.1;
  background-color: #5a8fc4;
}

.button:active:not(.button--disabled) {
  background-color: #3a6a9a;
}

.button.danger {
  background: #e2534b;
}

.button.danger:hover:not(.button--disabled) {
  background-color: #f0645a;
}

.button.danger:active:not(.button--disabled) {
  background-color: #d4423a;
}

.button.warning {
  background: #ffbe53;
}

.button.warning:hover:not(.button--disabled) {
  background-color: #ffc866;
}

.button.warning:active:not(.button--disabled) {
  background-color: #ffb440;
}

.button.default {
  background: #333333;
}

.button.default:hover:not(.button--disabled) {
  background-color: #444444;
}

.button.default:active:not(.button--disabled) {
  background-color: #222222;
}

.button.active {
  background: #2980b9;
}

.button.active:hover:not(.button--disabled) {
  background-color: #3a91c9;
}

.button.active:active:not(.button--disabled) {
  background-color: #1f6fa0;
}

.button--small {
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  font-size: 0.875rem;
}

.button--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button--disabled:hover {
  scale: 1;
}

/* Text buttons — тот же стиль как иконки, но без фикс. квадрата */
.button--text {
  width: auto;
  height: auto;
  min-width: auto;
  min-height: auto;
  /* border и drop-shadow наследуются от .button */
  font-weight: 600;
  gap: 8px;
  /* hover scale работает как у иконок */
}

.button--text-small {
  padding: 8px 16px;
  font-size: 14px;
}

.button--text-medium {
  padding: 12px 24px;
  font-size: 16px;
}

.button--text-large {
  padding: 16px 32px;
  font-size: 18px;
}

/* Доп. варианты для текстовых (если нужны) */
.button.primary {
  background: #e74c3c;
}

.button.primary:hover:not(.button--disabled) {
  background-color: #f85a4a;
}

.button.primary:active:not(.button--disabled) {
  background-color: #d63c2c;
}

.button.secondary {
  background: #2980b9;
}

.button.secondary:hover:not(.button--disabled) {
  background-color: #3a91c9;
}

.button.secondary:active:not(.button--disabled) {
  background-color: #1f6fa0;
}

.button.accent {
  background: #ffbe53;
}

.button.accent:hover:not(.button--disabled) {
  background-color: #ffc866;
}

.button.accent:active:not(.button--disabled) {
  background-color: #ffb440;
}
</style>
