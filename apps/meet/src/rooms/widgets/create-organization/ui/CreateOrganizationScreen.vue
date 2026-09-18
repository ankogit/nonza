<template>
  <ScreenLayout :centered="false">
    <div class="create-org">
      <div class="create-org__shell">
        <header class="create-org__topbar">
          <div class="create-org__brand-block">
            <button
              type="button"
              class="create-org__nav-btn"
              aria-label="Назад"
              title="Назад"
              @click="$emit('cancel')"
            >
              <PixelIcon name="left" variant="small" />
            </button>
            <div>
              <p class="create-org__brand">Nonza</p>
              <h1 class="create-org__heading">Новая организация</h1>
              <p class="create-org__sub">
                Комнаты, участники и совместная работа в одном пространстве.
              </p>
            </div>
          </div>
        </header>

        <MetroTile
          variant="green"
          size="wide"
          mark="+"
          class="create-org__panel"
        >
          <template #title>Создать</template>
          <form class="create-org__form" @submit.prevent="submit">
            <label class="create-org__label">
              Название
              <Input
                id="org-name"
                v-model="name"
                type="text"
                placeholder="Название организации"
                autocomplete="organization"
              />
            </label>
            <label class="create-org__label">
              Описание
              <Input
                id="org-desc"
                v-model="description"
                type="text"
                placeholder="Краткое описание"
              />
            </label>
            <span class="create-org__hint">Описание необязательно</span>
            <Alert v-if="error" variant="danger">{{ error }}</Alert>
            <div class="create-org__actions">
              <Button
                type="text"
                variant="default"
                size="large"
                native-type="button"
                class="create-org__ghost"
                @click="$emit('cancel')"
              >
                Отмена
              </Button>
              <Button
                type="text"
                variant="primary"
                size="large"
                native-type="submit"
                class="create-org__primary"
                :disabled="!name.trim() || submitting"
              >
                {{ submitting ? "Создание..." : "Создать" }}
              </Button>
            </div>
          </form>
        </MetroTile>
      </div>
    </div>
  </ScreenLayout>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  ScreenLayout,
  Input,
  Button,
  Alert,
  MetroTile,
  PixelIcon,
} from "@shared/ui";
import { OrganizationApi } from "@shared/entities";
import { useApiClient } from "@shared/api";
import type { Organization } from "@shared/entities";

const emit = defineEmits<{
  created: [org: Organization];
  cancel: [];
}>();

const apiClient = useApiClient();
const organizationApi = new OrganizationApi(apiClient);

const name = ref("");
const description = ref("");
const error = ref<string | null>(null);
const submitting = ref(false);

async function submit() {
  if (!name.value.trim()) return;
  error.value = null;
  submitting.value = true;
  try {
    const org = await organizationApi.create({
      name: name.value.trim(),
      description: description.value.trim() || undefined,
    });
    emit("created", org);
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : "Не удалось создать организацию";
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.create-org {
  width: 100%;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.create-org__shell {
  width: min(720px, 100%);
  margin: 0 auto;
  padding: 8px 0 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  box-sizing: border-box;
}

.create-org__topbar {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.create-org__brand-block {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.create-org__nav-btn {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 3px solid rgba(255, 255, 255, 0.14);
  background: #222;
  color: #fff;
  cursor: pointer;
  padding: 0;
  margin-top: 2px;
}

.create-org__nav-btn:hover {
  background: #2e2e2e;
  outline: 3px solid #fff;
  outline-offset: 2px;
}

.create-org__brand {
  margin: 0;
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.15rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #81b538;
  line-height: 1;
}

.create-org__heading {
  margin: 2px 0 0;
  font-family: "Bebas Neue", sans-serif;
  font-weight: normal;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: clamp(2rem, 5vw, 2.8rem);
  line-height: 0.92;
  color: #fff;
}

.create-org__sub {
  margin: 6px 0 0;
  max-width: 28rem;
  font-size: 0.95rem;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.65);
}

.create-org__panel {
  width: 100% !important;
  height: auto !important;
  min-height: 0 !important;
  overflow: hidden;
}

.create-org__panel :deep(.metro-tile__inner) {
  gap: 14px;
  padding: 22px 22px 18px;
  overflow: visible;
}

.create-org__panel :deep(.metro-tile__title) {
  font-size: clamp(2rem, 4.5vw, 2.8rem);
  letter-spacing: 0.03em;
  line-height: 0.9;
  max-width: 70%;
}

.create-org__panel :deep(.metro-tile__mark) {
  font-size: clamp(4.5rem, 14vw, 7.5rem);
  line-height: 0.85;
  top: -0.08em;
  right: -0.02em;
  bottom: auto;
  left: auto;
  max-width: none;
  max-height: none;
  width: auto;
  height: auto;
  padding: 0;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.12);
  transform: rotate(-6deg);
  transform-origin: top right;
  z-index: 0;
  pointer-events: none;
  overflow: visible;
  white-space: nowrap;
}

.create-org__panel :deep(.metro-tile__body) {
  position: relative;
  z-index: 2;
  margin-top: 4px;
  gap: 14px;
  overflow: visible;
  min-width: 0;
  width: 100%;
}

.create-org__form {
  display: grid;
  gap: 1rem;
  width: 100%;
  min-width: 0;
}

.create-org__label {
  display: grid;
  gap: 0.45rem;
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 9px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.85);
  min-width: 0;
}

.create-org__hint {
  margin: -0.35rem 0 0;
  font-size: 0.92rem;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.6);
}

.create-org__label :deep(.pixel-input),
.create-org__label :deep(input) {
  width: 100%;
  height: 52px;
  min-height: 52px;
  font-size: 17px;
  padding: 14px 16px;
  background: rgba(0, 0, 0, 0.28);
  border-color: #ffffff22;
  border-top-color: #ffffff38;
  border-left-color: #ffffff38;
  color: #fff;
  box-sizing: border-box;
}

.create-org__label :deep(.pixel-input:hover) {
  background: rgba(0, 0, 0, 0.36);
}

.create-org__label :deep(.pixel-input:focus) {
  background: rgba(0, 0, 0, 0.42);
  outline: 3px solid #fff;
  outline-offset: 2px;
}

.create-org__actions {
  display: flex;
  flex-flow: row wrap;
  gap: 12px;
  justify-content: flex-end;
  align-items: center;
  min-width: 0;
  padding-top: 6px;
}

.create-org__actions :deep(.button--text) {
  max-width: 100%;
  flex: 0 1 auto;
  min-width: 0;
  min-height: 52px;
  text-align: center;
  white-space: nowrap;
  overflow-wrap: normal;
  font-family: "Bebas Neue", sans-serif;
  font-weight: normal;
  font-size: 1.5rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1;
  padding: 14px 24px;
}

.create-org__ghost :deep(.button),
.create-org__actions :deep(.button--default) {
  background: #222;
}

@media (max-width: 640px) {
  .create-org__shell {
    padding: 0 0 20px;
    gap: 14px;
  }

  .create-org__panel :deep(.metro-tile__inner) {
    padding: 18px 14px 14px;
    gap: 12px;
  }

  .create-org__panel :deep(.metro-tile__title) {
    font-size: clamp(1.8rem, 8vw, 2.3rem);
    max-width: 100%;
  }

  .create-org__label :deep(.pixel-input),
  .create-org__label :deep(input) {
    height: 48px;
    min-height: 48px;
    font-size: 16px;
    padding: 12px 14px;
  }

  .create-org__actions {
    flex-direction: column-reverse;
    align-items: stretch;
    gap: 10px;
  }

  .create-org__actions :deep(.button--text) {
    width: 100%;
    justify-content: center;
    min-height: 48px;
    font-size: 1.35rem;
    padding: 14px 20px;
  }
}
</style>
