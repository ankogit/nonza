<template>
  <div class="org-panel">
    <button
      type="button"
      class="org-item org-item--logo"
      :class="{ 'org-item--active': selectedId === null }"
      aria-label="На главную"
      title="На главную"
      :aria-selected="selectedId === null"
      tabindex="0"
      @click="$emit('goHome')"
    >
      <span class="org-item__pill" />
      <span class="org-item__icon">
        <AppLogo size="strip" class="org-item__logo-img" />
      </span>
    </button>
    <div class="org-panel__divider org-panel__divider--top" />
    <div class="org-strip">
      <div class="org-strip__orgs">
        <button
          v-for="org in organizations"
          :key="org.id"
          type="button"
          class="org-item"
          :class="{ 'org-item--active': org.id === selectedId }"
          :aria-label="org.name"
          :aria-selected="org.id === selectedId"
          :title="org.name"
          tabindex="0"
          @click="$emit('select', org)"
        >
          <span class="org-item__pill" />
          <span class="org-item__icon">
            <span class="org-item__letter font-bebas">{{ orgLetter(org.name) }}</span>
          </span>
        </button>
      </div>
      <button
        type="button"
        class="org-item org-item--add"
        aria-label="Создать организацию"
        title="Создать организацию"
        tabindex="0"
        @click="$emit('create')"
      >
        <span class="org-item__icon">+</span>
      </button>
    </div>
    <div class="org-panel__divider" />
    <div class="org-strip org-strip--footer">
      <button
        type="button"
        class="org-item org-item--action"
        aria-label="Настройки"
        title="Настройки"
        tabindex="0"
        @click="$emit('settings')"
      >
        <span class="org-item__icon">⚙</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AppLogo } from "@shared/ui";
import type { Organization } from "@shared/entities";

defineProps<{
  organizations: Organization[];
  selectedId: string | null;
}>();

defineEmits<{
  select: [org: Organization];
  create: [];
  settings: [];
  goHome: [];
}>();

function orgLetter(name: string): string {
  if (!name || !name.trim()) return "?";
  return name.trim().charAt(0).toUpperCase();
}
</script>

<style scoped>
.org-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-height: 0;
  padding: 10px 0;
}

.org-panel__divider {
  width: 100%;
  flex-shrink: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.org-panel__divider--top {
  margin-top: 8px;
}

.org-panel__divider:not(.org-panel__divider--top) {
  margin-top: 8px;
}

.org-strip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 0;
}

.org-strip:not(.org-strip--footer) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.org-strip__orgs {
  padding-top: 8px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  width: 100%;
}

.org-strip__orgs::-webkit-scrollbar {
  display: none;
}

.org-strip--footer {
  flex: none;
  margin-top: auto;
  padding-top: 8px;
}

.org-item {
  --org-icon-bg: var(--color-surface);
  --org-active-bg: var(--color-primary);
  --org-pill: var(--color-accent);
  position: relative;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border: none;
  padding: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  color: var(--color-text-secondary);
  font: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    border-radius 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease;
}

.org-item:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.org-item__pill {
  position: absolute;
  left: -10px;
  top: 10px;
  width: 4px;
  height: 0;
  border-radius: 0 2px 2px 0;
  background: transparent;
  pointer-events: none;
  transition:
    height 0.2s ease,
    background 0.2s ease;
}

.org-item--active .org-item__pill {
  height: 28px;
  background: var(--org-pill);
}

.org-item:hover:not(.org-item--active),
.org-item:focus-visible:not(.org-item--active) {
  border-radius: 14px;
  background: var(--org-icon-bg);
  color: var(--color-text);
}

.org-item--active {
  border-radius: 14px;
  background: var(--org-active-bg);
  color: var(--color-text);
}

.org-item__icon {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: var(--org-icon-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1;
  transition:
    border-radius 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease;
}

.org-item--active .org-item__icon {
  background: transparent;
  color: inherit;
}

.org-item--logo {
  width: 64px;
  height: 64px;
}

.org-item--logo .org-item__icon {
  background: var(--org-icon-bg);
  padding: 2px;
}

.org-item--logo.org-item--active .org-item__icon {
  background: transparent;
}

.org-item--logo .org-item__icon :deep(.app-logo) {
  max-width: 100%;
  max-height: 100%;
}

.org-item__logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.org-item--logo .org-item__pill {
  top: 18px;
}

.org-item--add .org-item__icon,
.org-item--action .org-item__icon {
  background: var(--org-icon-bg);
  font-size: 1.5rem;
  font-weight: 400;
}

.org-item--add:hover .org-item__icon,
.org-item--add:focus-visible .org-item__icon,
.org-item--action:hover .org-item__icon,
.org-item--action:focus-visible .org-item__icon {
  background: var(--org-active-bg);
  color: var(--color-text);
}

.org-item__letter {
  line-height: 1;
}
</style>
