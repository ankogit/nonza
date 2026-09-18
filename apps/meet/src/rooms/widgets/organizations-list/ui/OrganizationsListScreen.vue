<template>
  <div class="organizations-list">
    <div class="organizations-list__shell">
      <header class="organizations-list__topbar">
        <div class="organizations-list__brand-block">
          <button
            type="button"
            class="organizations-list__menu-btn"
            aria-label="Меню"
            title="Меню"
            @click="openSidebarDrawer?.()"
          >
            <PixelIcon name="burger" variant="small" />
          </button>
          <div>
            <p class="organizations-list__brand">Nonza</p>
            <h1 class="organizations-list__heading">Организации</h1>
          </div>
        </div>
      </header>

      <div class="organizations-list__stage">
        <Transition name="soft-fade" mode="out-in">
          <div v-if="loading" key="loading" class="organizations-list__grid">
            <div
              v-for="i in 6"
              :key="i"
              class="organizations-list__skeleton-tile"
              :class="`organizations-list__skeleton-tile--${tileVariants[(i - 1) % tileVariants.length]}`"
            >
              <Skeleton variant="text" width="36%" :height="10" />
              <div class="organizations-list__skeleton-spacer" />
              <Skeleton variant="text" width="72%" :height="22" />
              <Skeleton variant="text" width="48%" :height="12" />
            </div>
          </div>
          <div
            v-else-if="!organizations.length"
            key="empty"
            class="organizations-list__empty"
          >
            <MetroTile
              variant="dark"
              size="wide"
              kicker="пусто"
              title="Нет организаций"
              mark="?"
            >
              <p class="organizations-list__empty-text">
                Создайте первую организацию или дождитесь приглашения.
              </p>
            </MetroTile>
          </div>
          <div v-else key="list" class="organizations-list__grid">
            <MetroTile
              v-for="(org, index) in organizations"
              :key="org.id"
              clickable
              size="rect"
              :variant="tileVariants[index % tileVariants.length]"
              kicker="организация"
              :title="org.name"
              :subtitle="org.description || undefined"
              :mark="orgLetter(org.name)"
              foot="открыть →"
              @click="$emit('select', org)"
            />
          </div>
        </Transition>
      </div>

      <p class="organizations-list__row-label">Действия</p>
      <div class="organizations-list__grid organizations-list__grid--actions">
        <MetroTile
          clickable
          size="rect"
          variant="blue"
          kicker="новая"
          title="Создать организацию"
          foot="старт →"
          class="organizations-list__action-tile"
          @click="$emit('create')"
        />
        <MetroTile
          clickable
          size="rect"
          variant="red"
          kicker="репорт"
          title="Сообщить о баге"
          foot="написать →"
          class="organizations-list__action-tile"
          @click="showReportBug = true"
        />
      </div>

      <ReportBugModal v-model="showReportBug" />

      <p class="organizations-list__row-label">Партнёры</p>
      <div class="organizations-list__grid organizations-list__grid--partners">
        <a
          v-for="partner in partners"
          :key="partner.url"
          :href="partner.url"
          target="_blank"
          rel="noopener noreferrer"
          class="organizations-list__partner"
        >
          <span class="organizations-list__partner-kicker">партнёр</span>
          <span class="organizations-list__partner-title">{{ partner.name }}</span>
          <span class="organizations-list__partner-foot">сайт →</span>
          <img
            v-if="partner.logo"
            :src="partner.logo"
            :alt="partner.name"
            class="organizations-list__partner-logo"
          />
        </a>
      </div>

      <section class="organizations-list__download">
        <span class="organizations-list__download-label">Приложение для ПК</span>
        <div class="organizations-list__download-row">
          <a
            :href="downloadUrl('windows')"
            class="organizations-list__download-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Windows
          </a>
          <a
            :href="downloadUrl('macos')"
            class="organizations-list__download-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            macOS
          </a>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, ref } from "vue";
import { MetroTile, Skeleton, PixelIcon } from "@shared/ui";
import type { MetroTileVariant } from "@shared/ui";
import type { Organization } from "@shared/entities";
import { getDesktopDownloadUrl } from "@shared/lib";
import { ReportBugModal } from "@rooms/features/report-bug";

const openSidebarDrawer = inject<(() => void) | undefined>("openSidebarDrawer");
const showReportBug = ref(false);

const tileVariants: MetroTileVariant[] = [
  "blue",
  "green",
  "gold",
  "purple",
  "dark",
  "red",
];

function downloadUrl(platform: "windows" | "macos"): string {
  return getDesktopDownloadUrl(platform);
}

defineProps<{
  organizations: Organization[];
  loading: boolean;
}>();

defineEmits<{
  select: [org: Organization];
  create: [];
}>();

const partners = [
  {
    name: "MandarinShow",
    url: "https://mandarinshow.ru",
    logo: "https://mandarinshow.ru/assets/img/main_iconv2_op.png",
  },
];

function orgLetter(name: string): string {
  if (!name || !name.trim()) return "?";
  return name.trim().charAt(0).toUpperCase();
}
</script>

<style scoped>
.organizations-list {
  width: 100%;
  max-width: min(1100px, 100%);
  min-height: min-content;
  display: flex;
  flex-direction: column;
}

.organizations-list__shell {
  flex: 1;
  min-height: 0;
  padding-bottom: 24px;
}

.organizations-list__topbar {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 1rem;
  margin-bottom: 1.1rem;
}

.organizations-list__brand-block {
  display: flex;
  align-items: end;
  gap: 12px;
  min-width: 0;
}

.organizations-list__menu-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 3px solid #444;
  border-top-color: #666;
  border-left-color: #666;
  border-radius: 0;
  background: #1a1a1a;
  color: #bab1a8;
  cursor: pointer;
  flex-shrink: 0;
  filter: drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.35));
  transition:
    background-color 0.15s ease,
    outline-color 0.12s ease;
  outline: 3px solid transparent;
  outline-offset: 2px;
}

.organizations-list__menu-btn:hover,
.organizations-list__menu-btn:focus-visible {
  background: #222;
  outline-color: #fff;
}

.organizations-list__brand {
  font-family: "Bebas Neue", sans-serif;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-size: 1.35rem;
  color: #81b538;
  margin: 0;
}

.organizations-list__heading {
  font-family: "Bebas Neue", sans-serif;
  font-weight: normal;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: clamp(2.4rem, 5vw, 3.4rem);
  line-height: 0.92;
  margin: 0.15rem 0 0;
  color: #fff;
}

.organizations-list__row-label {
  position: relative;
  z-index: 2;
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #2980b9;
  margin: 1.6rem 0 0.75rem;
  line-height: 1.5;
}

.organizations-list__row-label:first-of-type {
  margin-top: 2.75rem;
}

.organizations-list__stage {
  position: relative;
  z-index: 1;
  min-height: 228px;
}

.organizations-list__grid {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, 248px);
  align-items: stretch;
  justify-content: start;
}

.organizations-list__grid--actions,
.organizations-list__grid--partners {
  grid-template-columns: repeat(auto-fill, 248px);
}

.organizations-list__action-tile {
  isolation: isolate;
}

.organizations-list__action-tile :deep(.metro-tile__inner) {
  padding-right: 14px;
}

.organizations-list__action-tile :deep(.metro-tile__title) {
  max-width: 100%;
  position: relative;
  z-index: 1;
}

.organizations-list__action-tile :deep(.metro-tile__kicker),
.organizations-list__action-tile :deep(.metro-tile__foot) {
  max-width: 100%;
  position: relative;
  z-index: 1;
}

.organizations-list__skeleton-tile {
  width: 248px;
  height: 108px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  filter: drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.3));
  box-sizing: border-box;
}

.organizations-list__skeleton-spacer {
  flex: 1;
}

.organizations-list__skeleton-tile--blue {
  background: #2980b9;
}

.organizations-list__skeleton-tile--green {
  background: #1f6b4a;
}

.organizations-list__skeleton-tile--gold {
  background: #8a5a12;
}

.organizations-list__skeleton-tile--purple {
  background: #3d2a5c;
}

.organizations-list__skeleton-tile--dark {
  background: #222;
}

.organizations-list__skeleton-tile--red {
  background: #6b2f2f;
}

.organizations-list__empty {
  display: grid;
  max-width: 520px;
}

.organizations-list__empty-text {
  margin: 0;
  font-size: 0.88rem;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.4;
}

.organizations-list__partner {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  width: 248px;
  height: 108px;
  padding: 12px 14px 10px;
  box-sizing: border-box;
  overflow: hidden;
  text-decoration: none;
  color: #fff7e8;
  background: #8a5a12;
  border: 3px solid rgba(255, 255, 255, 0.1);
  filter: drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.3));
  outline: 3px solid transparent;
  outline-offset: 2px;
  transition:
    transform 0.12s ease,
    filter 0.12s ease,
    outline-color 0.12s ease;
}

.organizations-list__partner::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.05) 0%,
    transparent 45%,
    rgba(0, 0, 0, 0.08) 100%
  );
  pointer-events: none;
}

.organizations-list__partner:hover,
.organizations-list__partner:focus-visible {
  transform: scale(1.015);
  outline-color: #fff;
  z-index: 2;
  filter: drop-shadow(4px 4px 0 rgba(0, 0, 0, 0.4));
}

.organizations-list__partner-kicker {
  position: relative;
  z-index: 1;
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 7px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.8;
  line-height: 1.35;
}

.organizations-list__partner-title {
  position: relative;
  z-index: 1;
  margin-top: auto;
  max-width: calc(100% - 64px);
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.45rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.organizations-list__partner-foot {
  position: relative;
  z-index: 1;
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 7px;
  opacity: 0.72;
  line-height: 1.35;
}

.organizations-list__partner-logo {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 1;
  width: 48px;
  height: 48px;
  object-fit: contain;
  border: 2px solid rgba(255, 255, 255, 0.85);
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.18);
  pointer-events: none;
}

.organizations-list__download {
  margin-top: 28px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.organizations-list__download-label {
  display: block;
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.35);
  margin-bottom: 10px;
}

.organizations-list__download-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.organizations-list__download-link {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-primary, #2980b9);
  text-decoration: none;
}

.organizations-list__download-link:hover {
  text-decoration: underline;
}

@media (max-width: 640px) {
  .organizations-list__grid,
  .organizations-list__grid--actions,
  .organizations-list__grid--partners {
    grid-template-columns: 1fr;
  }

  .organizations-list__skeleton-tile,
  .organizations-list__grid :deep(.metro-tile--rect),
  .organizations-list__grid :deep(.metro-tile--default),
  .organizations-list__partner {
    width: 100%;
    max-width: none;
  }

  .organizations-list__skeleton-tile {
    height: 100px;
  }
}

@media (max-width: 480px) {
  .organizations-list__menu-btn {
    display: flex;
  }

  .organizations-list__topbar {
    align-items: center;
  }

  .organizations-list__brand-block {
    align-items: center;
  }

  .organizations-list__stage {
    min-height: 212px;
  }
}

.soft-fade-enter-active,
.soft-fade-leave-active {
  transition: opacity 0.2s ease;
}

.soft-fade-enter-from,
.soft-fade-leave-to {
  opacity: 0;
}
</style>
