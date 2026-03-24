<template>
  <div ref="rootRef" class="participant-color-palette">
    <button
      type="button"
      class="participant-color-palette__swatch"
      :class="{ 'participant-color-palette__swatch--eraser': eraser }"
      :style="eraser ? undefined : { backgroundColor: modelValue }"
      :title="swatchTitle"
      :aria-label="swatchAriaLabel"
      :aria-expanded="expanded"
      :disabled="disabled"
      @click="toggle"
    >
      <slot name="swatch" />
    </button>
    <div
      class="participant-color-palette__strip"
      :class="{ 'participant-color-palette__strip--expanded': expanded }"
    >
      <template v-if="expanded">
        <button
          v-for="c in palette"
          :key="c"
          type="button"
          class="participant-color-palette__dot"
          :class="{
            'participant-color-palette__dot--active':
              !eraser && modelValue === c,
          }"
          :style="{ backgroundColor: c }"
          :title="c"
          :aria-label="`Цвет ${c}`"
          :disabled="disabled"
          @click="select(c)"
        />
        <button
          type="button"
          class="participant-color-palette__dot participant-color-palette__dot--custom participant-color-palette__dot--trigger"
          :title="customTitle"
          :aria-label="customAriaLabel"
          :disabled="disabled"
          @click="openNativePicker"
        />
        <input
          ref="nativeInputRef"
          class="participant-color-palette__native-input"
          type="color"
          :value="modelValue"
          :aria-label="nativePickerAriaLabel"
          :disabled="disabled"
          @input="onNativeInput"
        />
        <button
          v-if="showReset"
          type="button"
          class="participant-color-palette__dot participant-color-palette__dot--reset"
          :class="{
            'participant-color-palette__dot--active': resetActive,
          }"
          :title="resetTitle"
          :aria-label="resetAriaLabel"
          :disabled="disabled"
          @click="emit('reset')"
        >
          −
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from "vue";
import { PARTICIPANT_COLOR_PALETTE } from "@shared/lib";

const modelValue = defineModel<string>({ required: true });
const expanded = defineModel<boolean>("expanded", { default: false });

const emit = defineEmits<{
  reset: [];
  pick: [];
}>();

const props = withDefaults(
  defineProps<{
    palette?: string[];
    eraser?: boolean;
    disabled?: boolean;
    showReset?: boolean;
    resetActive?: boolean;
    swatchTitle?: string;
    swatchAriaLabel?: string;
    customTitle?: string;
    customAriaLabel?: string;
    nativePickerAriaLabel?: string;
    resetTitle?: string;
    resetAriaLabel?: string;
  }>(),
  {
    palette: () => [...PARTICIPANT_COLOR_PALETTE],
    eraser: false,
    disabled: false,
    showReset: false,
    resetActive: false,
    swatchTitle: "Цвет",
    swatchAriaLabel: "Развернуть палитру",
    customTitle: "Свой цвет",
    customAriaLabel: "Свой цвет",
    nativePickerAriaLabel: "Выбор цвета",
    resetTitle: "Сбросить цвет",
    resetAriaLabel: "Сбросить цвет",
  },
);

const rootRef = ref<HTMLElement | null>(null);
const nativeInputRef = ref<HTMLInputElement | null>(null);

function toggle() {
  if (props.disabled) return;
  expanded.value = !expanded.value;
}

function select(c: string) {
  modelValue.value = c;
  expanded.value = false;
  emit("pick");
}

function openNativePicker() {
  nativeInputRef.value?.click();
}

function onNativeInput(ev: Event) {
  const el = ev.target as HTMLInputElement;
  if (el.value) {
    modelValue.value = el.value;
    expanded.value = false;
    emit("pick");
  }
}

let closeOnDoc: ((e: MouseEvent) => void) | null = null;
watch(expanded, (isOpen) => {
  if (closeOnDoc) {
    document.removeEventListener("click", closeOnDoc);
    closeOnDoc = null;
  }
  if (!isOpen) return;
  closeOnDoc = (e: MouseEvent) => {
    const el = rootRef.value;
    if (el?.contains(e.target as Node)) return;
    expanded.value = false;
  };
  requestAnimationFrame(() => document.addEventListener("click", closeOnDoc!));
});

onBeforeUnmount(() => {
  if (closeOnDoc) {
    document.removeEventListener("click", closeOnDoc);
    closeOnDoc = null;
  }
});
</script>

<style scoped>
.participant-color-palette {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.participant-color-palette__swatch {
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--color-primary, #2980b9);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  font-weight: 500;
  font-family: "Bebas Neue", sans-serif;
  color: #fff;
  flex-shrink: 0;
  cursor: pointer;
  transition: filter 0.15s ease;
}

.participant-color-palette__swatch:hover:not(:disabled) {
  filter: brightness(1.1);
}

.participant-color-palette__swatch--eraser {
  background: repeating-linear-gradient(
    -45deg,
    #4a4a4a,
    #4a4a4a 4px,
    #2a2a2a 4px,
    #2a2a2a 8px
  );
}

.participant-color-palette__strip {
  position: absolute;
  left: 100%;
  margin-left: 10px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.25);
  z-index: 10;
  height: fit-content;
}

.participant-color-palette__strip--expanded {
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
}

.participant-color-palette__strip--expanded
  .participant-color-palette__dot:not(
    .participant-color-palette__dot--trigger
  ) {
  animation: participant-color-palette-dot-in 0.15s ease-out;
}

@keyframes participant-color-palette-dot-in {
  from {
    opacity: 0;
    transform: scale(0.8);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

.participant-color-palette__dot {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 2px solid #444;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    filter 0.15s ease;
  font-size: 12px;
  line-height: 1;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.08);
}

.participant-color-palette__native-input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
  padding: 0;
  border: 0;
}

.participant-color-palette__dot--custom {
  background: rgba(255, 255, 255, 0.06);
  border-style: solid;
  border-color: rgba(255, 255, 255, 0.35);
  position: relative;
  overflow: hidden;
}

.participant-color-palette__dot--custom::before {
  content: "";
  position: absolute;
  inset: -25%;
  border-radius: 50%;
  background: conic-gradient(
    from 90deg,
    #ff4d4d,
    #ffcc3d,
    #4dff9a,
    #4dc3ff,
    #7d4dff,
    #ff4dc4,
    #ff4d4d
  );
  animation: participant-color-palette-rgb-spin 1.8s linear infinite;
  z-index: 0;
}

.participant-color-palette__dot--custom::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(
    circle at 30% 30%,
    rgba(255, 255, 255, 0.35),
    rgba(255, 255, 255, 0) 55%
  );
  z-index: 1;
}

@keyframes participant-color-palette-rgb-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .participant-color-palette__dot--custom::before {
    animation: none;
  }
}

.participant-color-palette__dot:hover:not(:disabled) {
  filter: brightness(1.15);
  border-color: rgba(255, 255, 255, 0.25);
}

.participant-color-palette__dot--active {
  border-color: #fff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
}

.participant-color-palette__dot--reset {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

@media (max-width: 480px) {
  .participant-color-palette__strip {
    margin-bottom: 8px;
  }
}
</style>
