<template>
  <div class="card-tile" :class="{ 'card-tile--clickable': clickable }" @click="clickable ? $emit('click') : undefined">
    <slot name="prefix" />
    <div class="card-tile__content">
      <slot />
    </div>
    <div v-if="$slots.actions" class="card-tile__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    clickable?: boolean;
  }>(),
  { clickable: false },
);

defineEmits<{
  click: [];
}>();
</script>

<style scoped>
.card-tile {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0;
  color: #bab1a8;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.card-tile--clickable {
  cursor: pointer;
  text-align: left;
}

.card-tile--clickable:hover {
  border-color: rgba(255, 255, 255, 0.12);
  background: radial-gradient(
      circle at 0% 50%,
      rgba(255, 255, 255, 0.08),
      transparent 70%
    ),
    rgba(255, 255, 255, 0.06);
}

.card-tile--clickable:focus-visible {
  outline: none;
  border-color: #2980b9;
  background: rgba(41, 128, 185, 0.08);
}

.card-tile__content {
  flex: 1;
  min-width: 0;
}

.card-tile__actions {
  flex-shrink: 0;
}
</style>
