<template>
  <ScreenLayout narrow>
    <div class="settings-screen settings-screen--page">
      <header class="settings-screen__header">
        <h2 class="settings-screen__title">Настройки</h2>
        <Button
          type="icon"
          variant="default"
          :icon-size="'32px'"
          title="Назад"
          aria-label="Назад"
          @click="$emit('back')"
        >
          ✕
        </Button>
      </header>
      <div class="settings-screen__body">
        <FormSection label="Имя">
          <Input
            v-model="nameEdit"
            placeholder="Введите имя"
            aria-label="Имя"
          />
        </FormSection>
        <FormSection label="Email">
          <span class="settings-screen__readonly">{{ user?.email ?? "—" }}</span>
        </FormSection>
        <hr class="HR" />
        <div class="settings-screen__danger">
          <h3 class="settings-screen__danger-title">Выйти из аккаунта</h3>
          <p class="settings-screen__danger-hint">
            Вы выйдете из приложения. Для входа снова потребуется email и пароль.
          </p>
          <Button
            type="text"
            variant="danger"
            size="small"
            @click="handleLogout"
          >
            Выйти
          </Button>
        </div>
      </div>
      <footer class="settings-screen__footer">
        <Button
          type="text"
          variant="primary"
          size="small"
          :disabled="saving || !nameDirty"
          @click="saveProfile"
        >
          {{ saving ? "Сохранение…" : "Сохранить" }}
        </Button>
        <Button type="text" variant="default" size="small" @click="$emit('back')">
          Закрыть
        </Button>
      </footer>
    </div>
  </ScreenLayout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ScreenLayout, Button, Input, FormSection } from "@shared/ui";
import {
  getAuthState,
  clearAuth,
  updateAuthUser,
} from "@shared/lib";
import { AuthApi } from "@shared/entities";
import { useApiClient } from "@shared/api";

const apiClient = useApiClient();
const authApi = new AuthApi(apiClient);

const emit = defineEmits<{
  back: [];
  logout: [];
}>();

const user = computed(() => getAuthState()?.user ?? null);
const nameEdit = ref(user.value?.name ?? "");
const saving = ref(false);

watch(user, (u) => {
  nameEdit.value = u?.name ?? "";
}, { immediate: true });

const nameDirty = computed(() => (user.value?.name ?? "") !== nameEdit.value.trim());

async function saveProfile() {
  if (!nameDirty.value || saving.value) return;
  saving.value = true;
  try {
    const res = await authApi.updateMe({ name: nameEdit.value.trim() });
    updateAuthUser({ name: res.user.name });
  } catch {
    // ignore
  } finally {
    saving.value = false;
  }
}

function handleLogout() {
  clearAuth();
  emit("logout");
}
</script>

<style scoped>
.settings-screen--page {
  background: #1f1f1f;
  border: 3px solid #444;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.5), 8px 8px 0 0 rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-screen__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 2px solid #333;
  background: #2a2a2a;
  gap: 16px;
}

.settings-screen__title {
  margin: 0;
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.5rem;
  font-weight: 400;
  color: #bab1a8;
  letter-spacing: 0.02em;
  flex: 1;
}

.settings-screen__body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  color: #bab1a8;
}

.settings-screen__readonly {
  font-size: 16px;
  color: #bab1a8;
}

.settings-screen__danger {
  padding-top: 8px;
}

.settings-screen__danger-title {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #999;
}

.settings-screen__danger-hint {
  margin: 0 0 12px 0;
  color: #999;
  font-size: 14px;
  line-height: 1.4;
}

.settings-screen__footer {
  padding: 20px;
  border-top: 2px solid #333;
  background: #2a2a2a;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
</style>
