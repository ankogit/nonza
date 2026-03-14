<template>
  <div class="organizations-list">
    <div class="organizations-list__main">
      <PageHeader title="Организации" />
      <div v-if="loading" class="organizations-list__loading">Загрузка...</div>
      <ListEmpty v-else-if="!organizations.length" message="Нет организаций" />
      <div v-else class="organizations-list__grid">
        <CardTile
          v-for="org in organizations"
          :key="org.id"
          clickable
          @click="$emit('select', org)"
        >
          <template #prefix>
            <span class="organizations-list__letter">{{
              orgLetter(org.name)
            }}</span>
          </template>
          <span class="organizations-list__name">{{ org.name }}</span>
          <span v-if="org.description" class="organizations-list__desc">{{
            org.description
          }}</span>
        </CardTile>
      </div>
      <div class="organizations-list__actions">
        <Button
          type="text"
          variant="primary"
          size="medium"
          @click="$emit('create')"
        >
          + Создать организацию
        </Button>
      </div>
    </div>
    <section class="organizations-list__partners">
      <span class="organizations-list__partners-label">Партнёры</span>
      <div class="organizations-list__partners-row">
        <a
          v-for="partner in partners"
          :key="partner.url"
          :href="partner.url"
          target="_blank"
          rel="noopener noreferrer"
          class="organizations-list__partner-tile"
        >
          <CardTile clickable>
            <div
              v-if="partner.logo"
              class="organizations-list__partner-content"
            >
              <img
                :src="partner.logo"
                :alt="partner.name"
                class="organizations-list__partner-logo"
              />
              <span class="organizations-list__partner-name">{{
                partner.name
              }}</span>
            </div>
            <span v-else class="organizations-list__partner-name">{{
              partner.name
            }}</span>
          </CardTile>
        </a>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { PageHeader, CardTile, ListEmpty, Button } from "@shared/ui";
import type { Organization } from "@shared/entities";

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
    name: "mandarinshow.ru",
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
  max-width: 420px;
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.organizations-list__main {
  flex: 1;
  min-height: 0;
}

.organizations-list__loading {
  padding: 48px 0;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 15px;
}

.organizations-list__grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.organizations-list__letter {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2a2a2a;
  border-radius: 50%;
  font-size: 1.125rem;
  font-weight: 600;
  color: #bab1a8;
  transition:
    background-color 0.2s ease,
    border-radius 0.2s ease,
    color 0.2s ease;
}

:deep(.card-tile--clickable:hover) .organizations-list__letter,
:deep(.card-tile--clickable:focus-within) .organizations-list__letter {
  border-radius: 12px;
  background: var(--color-primary);
  color: #fff;
}

.organizations-list__name {
  display: block;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 2px;
  color: #bab1a8;
}

.organizations-list__desc {
  display: block;
  font-size: 13px;
  color: #999;
  line-height: 1.35;
}

.organizations-list__actions {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.organizations-list__partners {
  flex-shrink: 0;
  margin-top: auto;
  padding-top: 24px;
  padding-bottom: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.organizations-list__partners-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.35);
  margin-bottom: 12px;
}

.organizations-list__partners-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.organizations-list__partner-tile {
  width: 130px;
  aspect-ratio: 1;
  text-decoration: none;
  color: inherit;
}

.organizations-list__partner-tile :deep(.card-tile) {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.organizations-list__partner-tile:hover :deep(.card-tile) {
  opacity: 1;
}

.organizations-list__partner-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-height: 0;
}

.organizations-list__partner-logo {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  flex-shrink: 1;
  border: 3px solid #fff;
  border-radius: 50%;
}

.organizations-list__partner-name {
  font-size: 10px;
  font-weight: 500;
  color: #bab1a8;
  text-align: center;
  word-break: break-all;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}
</style>
