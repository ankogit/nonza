<template>
  <ScreenLayout>
    <div class="create-org auth-stage">
      <MetroTile
        variant="green"
        size="wide"
        mark="+"
        class="create-org__tile"
      >
        <template #title>Создать организацию</template>
        <p class="create-org__lead">
          Пространство для комнат, участников и совместной работы.
        </p>
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
  </ScreenLayout>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ScreenLayout, Input, Button, Alert, MetroTile } from "@shared/ui";
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
.auth-stage {
  min-height: min(78vh, 760px);
  display: grid;
  place-items: center;
  width: 100%;
  padding: 12px 0 28px;
  box-sizing: border-box;
}

.create-org__tile {
  width: min(620px, 100%);
  min-height: 420px;
  overflow: hidden;
}

.create-org__tile :deep(.metro-tile__inner) {
  gap: 18px;
  padding: 28px 32px 24px;
  overflow: visible;
}

.create-org__tile :deep(.metro-tile__title) {
  font-size: clamp(2.4rem, 5.5vw, 3.4rem);
  letter-spacing: 0.03em;
  line-height: 0.9;
  max-width: 88%;
}

.create-org__tile :deep(.metro-tile__mark) {
  font-size: clamp(7rem, 22vw, 12rem);
  line-height: 0.85;
  top: -0.12em;
  right: -0.04em;
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

.create-org__tile :deep(.metro-tile__body) {
  position: relative;
  z-index: 2;
  margin-top: 8px;
  gap: 18px;
  overflow: visible;
  min-width: 0;
}

.create-org__lead {
  margin: 0;
  max-width: 28rem;
  font-size: 1rem;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.82);
}

.create-org__form {
  display: grid;
  gap: 1.1rem;
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
  margin: -0.4rem 0 0;
  font-size: 0.92rem;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.6);
}

.create-org__label :deep(.pixel-input),
.create-org__label :deep(input) {
  width: 100%;
  height: 56px;
  min-height: 56px;
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
  gap: 14px;
  justify-content: flex-end;
  align-items: center;
  min-width: 0;
  padding-top: 10px;
  margin-top: 4px;
}

.create-org__actions :deep(.button--text) {
  max-width: 100%;
  flex: 0 1 auto;
  min-width: 0;
  min-height: 56px;
  text-align: center;
  white-space: nowrap;
  overflow-wrap: normal;
  font-family: "Bebas Neue", sans-serif;
  font-weight: normal;
  font-size: 1.6rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1;
  padding: 16px 28px;
}

.create-org__ghost :deep(.button),
.create-org__actions :deep(.button--default) {
  background: #222;
}

@media (max-width: 640px) {
  .auth-stage {
    min-height: 0;
    place-items: stretch;
    padding: 0;
    width: 100%;
  }

  .create-org__tile {
    width: 100%;
    min-height: 0;
  }

  .create-org__tile :deep(.metro-tile__inner) {
    padding: 20px 16px 16px;
    gap: 14px;
  }

  .create-org__tile :deep(.metro-tile__title) {
    font-size: clamp(2rem, 9vw, 2.6rem);
    max-width: 100%;
  }

  .create-org__lead {
    font-size: 0.92rem;
  }

  .create-org__form {
    gap: 0.9rem;
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
