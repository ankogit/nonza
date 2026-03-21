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
      <div class="org-strip__orgs" ref="orgsContainerRef">
        <div
          class="org-indicator"
          aria-hidden="true"
          :class="{ 'org-indicator--visible': indicatorVisible }"
          :style="{ transform: `translateY(${indicatorY}px)` }"
        />
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
          <span class="org-item__icon">
            <span class="org-item__letter font-bebas">{{
              orgLetter(org.name)
            }}</span>
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
        <span class="org-item__icon">
          <PixelIcon name="add" :size="26" />
        </span>
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
        <span class="org-item__icon org-item__icon--pair">
          <PixelIcon name="settings-alt" :size="20" />
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AppLogo, PixelIcon } from "@shared/ui";
import type { Organization } from "@shared/entities";
import { nextTick, onMounted, ref, watch } from "vue";

const props = defineProps<{
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

const ORG_INDICATOR_HEIGHT_PX = 28;

const orgsContainerRef = ref<HTMLElement | null>(null);
const indicatorY = ref(0);
const indicatorVisible = ref(false);

function updateIndicator() {
  const container = orgsContainerRef.value;
  if (!container) {
    indicatorVisible.value = false;
    return;
  }

  const activeButton = container.querySelector<HTMLButtonElement>(
    'button[aria-selected="true"]',
  );

  if (!activeButton) {
    indicatorVisible.value = false;
    return;
  }

  const top = activeButton.offsetTop;
  indicatorY.value =
    top + (activeButton.offsetHeight - ORG_INDICATOR_HEIGHT_PX) / 2;
  indicatorVisible.value = true;
}

watch(
  () => props.selectedId,
  async () => {
    await nextTick();
    updateIndicator();
  },
  { immediate: true },
);

watch(
  () => props.organizations.length,
  async () => {
    await nextTick();
    updateIndicator();
  },
);

onMounted(async () => {
  await nextTick();
  updateIndicator();
});
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
  width: 100%;
}

.org-strip:not(.org-strip--footer) {
  flex: 1;
  min-height: 0;
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
  position: relative;
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
  --org-icon-bg: rgba(255, 255, 255, 0.04);
  --org-active-bg: var(--color-primary);
  --org-pill: var(--color-accent);
  position: relative;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  box-sizing: border-box;
  border: 3px solid #ffffff10;
  border-top: 3px solid #ffffff20;
  border-left: 3px solid #ffffff20;
  padding: 0;
  border-radius: 50%;
  background: #333333;
  cursor: pointer;
  color: var(--color-text-secondary);
  font: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(2px 2px 0px rgba(0, 0, 0, 0.25));
  transition:
    scale 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
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

.org-indicator {
  position: absolute;
  left: auto;
  right: 0px;
  top: 0;
  width: 4px;
  height: 28px;
  background: var(--color-accent);
  border-radius: 2px 0 0 2px;
  pointer-events: none;
  z-index: 2;
  box-shadow: -1px 0 0 rgba(0, 0, 0, 0.25);
  opacity: 0;
  transition:
    opacity 0.15s ease,
    transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  transform: translateY(0);
}

.org-indicator--visible {
  opacity: 1;
}

.org-item:hover:not(.org-item--active),
.org-item:focus-visible:not(.org-item--active) {
  scale: 1.05;
  background-color: #444444;
  color: var(--color-text);
}

.org-item--active {
  background-color: #444444;
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--color-text);
  scale: 1.05;
}

.org-item:active:not(.org-item--active) {
  background-color: #222222;
  scale: 1;
}

.org-item__icon {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1;
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
  padding: 2px;
  background: transparent;
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
  font-size: 1.5rem;
  font-weight: 400;
}

.org-item__letter {
  line-height: 1;
  width: 100%;
  text-align: center;
  position: relative;
  top: 1px;
}

.org-item__icon--pair {
  gap: 1px;
}
</style>
