<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="context-menu-overlay"
      aria-hidden="true"
      @click="close"
    />
    <div
      v-if="modelValue && position"
      class="context-menu"
      role="menu"
      :style="menuStyle"
      @click.stop
    >
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="context-menu__item"
        :class="{ 'context-menu__item--danger': item.danger }"
        role="menuitem"
        @click="onSelect(item)"
      >
        {{ item.label }}
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, onUnmounted } from "vue";

export interface ContextMenuItem {
  id: string;
  label: string;
  danger?: boolean;
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    position?: { x: number; y: number };
    items: ContextMenuItem[];
    menuWidth?: number;
    menuItemHeight?: number;
  }>(),
  {
    menuWidth: 160,
    menuItemHeight: 44,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  select: [item: ContextMenuItem];
}>();

const menuStyle = computed(() => {
  if (!props.position) return {};
  const w = props.menuWidth;
  const h = props.items.length * props.menuItemHeight;
  const x = Math.min(
    Math.max(0, props.position.x),
    window.innerWidth - w,
  );
  const y = Math.min(
    Math.max(0, props.position.y),
    window.innerHeight - h,
  );
  return { left: `${x}px`, top: `${y}px` };
});

function close() {
  emit("update:modelValue", false);
}

function onSelect(item: ContextMenuItem) {
  emit("select", item);
  close();
}

function handleEscape(e: KeyboardEvent) {
  if (e.key === "Escape") close();
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      document.addEventListener("keydown", handleEscape);
    } else {
      document.removeEventListener("keydown", handleEscape);
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  document.removeEventListener("keydown", handleEscape);
});
</script>

<style scoped>
.context-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
}

.context-menu {
  position: fixed;
  z-index: 10000;
  min-width: 160px;
  padding: 4px 0;
  background: #2a2a2a;
  border: 2px solid #444;
  box-shadow: 4px 4px 12px rgba(0, 0, 0, 0.4);
}

.context-menu__item {
  display: block;
  width: 100%;
  padding: 8px 16px;
  border: none;
  background: none;
  font: inherit;
  color: #e0e0e0;
  text-align: left;
  cursor: pointer;
}

.context-menu__item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.context-menu__item--danger {
  color: #e2534b;
}

.context-menu__item--danger:hover {
  background: rgba(231, 76, 60, 0.15);
}
</style>
