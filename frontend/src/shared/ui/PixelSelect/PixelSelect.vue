<template>
  <div
    ref="rootRef"
    class="pixel-select"
    :class="{ 'pixel-select--open': isOpen }"
  >
    <button
      :id="id"
      type="button"
      class="pixel-select__trigger"
      :disabled="disabled"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      :aria-label="ariaLabel"
      @click="toggle"
    >
      <span class="pixel-select__value">{{ displayLabel }}</span>
    </button>
    <Transition name="pixel-select-drop">
      <ul
        v-show="isOpen"
        ref="listRef"
        class="pixel-select__dropdown"
        :class="{ 'pixel-select__dropdown--above': !openDown }"
        role="listbox"
        :aria-activedescendant="highlightedId"
        tabindex="-1"
        @keydown="onListKeydown"
      >
        <li
          v-for="opt in options"
          :id="opt.id"
          :key="String(opt.value)"
          class="pixel-select__option"
          role="option"
          :aria-selected="modelValue === opt.value"
          :class="{
            'pixel-select__option--selected': modelValue === opt.value,
            'pixel-select__option--highlighted': highlightedIndex === opt.index,
          }"
          @click="select(opt)"
          @mouseenter="highlightedIndex = opt.index"
        >
          {{ opt.label }}
        </li>
      </ul>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";

export interface PixelSelectOption {
  value: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: PixelSelectOption[];
    placeholder?: string;
    disabled?: boolean;
    id?: string;
    ariaLabel?: string;
  }>(),
  {
    placeholder: "",
    disabled: false,
    id: undefined,
    ariaLabel: "Выберите значение",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const rootRef = ref<HTMLElement | null>(null);
const listRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const highlightedIndex = ref(0);
const openDown = ref(true);

const optionsWithMeta = computed(() =>
  props.options.map((o, index) => ({
    ...o,
    index,
    id: `pixel-select-opt-${props.id ?? "sel"}-${index}`,
  })),
);

const options = optionsWithMeta;

const displayLabel = computed(() => {
  const opt = props.options.find((o) => o.value === props.modelValue);
  return opt ? opt.label : props.placeholder;
});

const highlightedId = computed(() => {
  const opt = optionsWithMeta.value[highlightedIndex.value];
  return opt?.id ?? null;
});

function toggle() {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    const idx = props.options.findIndex((o) => o.value === props.modelValue);
    highlightedIndex.value = idx >= 0 ? idx : 0;
    updatePlacement();
    nextTick(() => listRef.value?.focus());
  }
}

function updatePlacement() {
  const el = rootRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  openDown.value = spaceBelow >= spaceAbove;
}

function select(opt: PixelSelectOption & { index: number; id: string }) {
  emit("update:modelValue", opt.value);
  isOpen.value = false;
}

function onListKeydown(e: KeyboardEvent) {
  const len = props.options.length;
  if (e.key === "Escape") {
    isOpen.value = false;
    (
      rootRef.value?.querySelector(".pixel-select__trigger") as HTMLElement
    )?.focus();
    e.preventDefault();
    return;
  }
  if (e.key === "ArrowDown") {
    highlightedIndex.value = (highlightedIndex.value + 1) % len;
    e.preventDefault();
    return;
  }
  if (e.key === "ArrowUp") {
    highlightedIndex.value = (highlightedIndex.value - 1 + len) % len;
    e.preventDefault();
    return;
  }
  if (e.key === "Enter" || e.key === " ") {
    const opt = optionsWithMeta.value[highlightedIndex.value];
    if (opt) {
      emit("update:modelValue", opt.value);
      isOpen.value = false;
    }
    e.preventDefault();
  }
}

function handleClickOutside(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    isOpen.value = false;
  }
}

watch(isOpen, (open) => {
  if (open) {
    document.addEventListener("click", handleClickOutside, true);
  } else {
    document.removeEventListener("click", handleClickOutside, true);
  }
});
</script>

<style scoped>
.pixel-select {
  position: relative;
  width: 100%;
}

.pixel-select__trigger {
  width: 100%;
  min-height: 44px;
  padding: 8px 36px 8px 12px;
  border: 3px solid #444;
  background: #1a1a1a
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23bab1a8' stroke-width='3' stroke-linecap='square' stroke-linejoin='miter'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")
    right 10px center / 20px 20px no-repeat;
  color: #bab1a8;
  font-size: 16px;
  font-family: inherit;
  text-align: left;
  outline: none;
  border-radius: 0;
  cursor: pointer;
  transition: none;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
}

.pixel-select__trigger:hover:not(:disabled) {
  border-color: #555;
  background-color: #252525;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23bab1a8' stroke-width='3' stroke-linecap='square' stroke-linejoin='miter'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-position: right 10px center;
  background-size: 20px 20px;
  background-repeat: no-repeat;
}

.pixel-select__trigger:focus {
  border-color: #2980b9;
  box-shadow:
    2px 2px 0 0 rgba(0, 0, 0, 0.3),
    inset 0 0 0 2px #2980b9;
}

.pixel-select__trigger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pixel-select--open .pixel-select__trigger {
  border-color: #2980b9;
  box-shadow:
    2px 2px 0 0 rgba(0, 0, 0, 0.3),
    inset 0 0 0 2px #2980b9;
}

.pixel-select__value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pixel-select__dropdown {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  margin: 0;
  padding: 4px;
  list-style: none;
  border: 3px solid #444;
  background: #1a1a1a;
  box-shadow:
    2px 2px 0 0 rgba(0, 0, 0, 0.3),
    4px 4px 0 0 rgba(0, 0, 0, 0.2);
  border-radius: 0;
  max-height: 280px;
  overflow-y: auto;
  z-index: 1000;
  outline: none;
}

.pixel-select__dropdown--above {
  top: auto;
  bottom: calc(100% + 4px);
}

.pixel-select__dropdown:focus {
  border-color: #2980b9;
}

.pixel-select__option {
  padding: 10px 12px;
  color: #bab1a8;
  font-size: 16px;
  cursor: pointer;
  border: 2px solid transparent;
  margin: 0 -2px;
  transition: none;
}

.pixel-select__option:hover,
.pixel-select__option--highlighted {
  background: #252525;
  border-color: #555;
}

.pixel-select__option--selected {
  background: rgba(41, 128, 185, 0.2);
  border-color: #2980b9;
  color: #fff;
}

.pixel-select__option--selected.pixel-select__option--highlighted {
  background: rgba(41, 128, 185, 0.35);
  border-color: #3a9ae0;
}

/* transition: открытие снизу */
.pixel-select-drop-enter-active,
.pixel-select-drop-leave-active {
  transition:
    opacity 0.1s ease,
    transform 0.1s ease;
}

.pixel-select-drop-enter-from,
.pixel-select-drop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* открытие сверху */
.pixel-select__dropdown--above.pixel-select-drop-enter-from,
.pixel-select__dropdown--above.pixel-select-drop-leave-to {
  transform: translateY(4px);
}
</style>
