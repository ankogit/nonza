<template>
  <ScreenLayout>
    <div class="settings-screen">
      <div class="settings-screen__shell">
        <header class="settings-screen__topbar">
          <div class="settings-screen__brand-block">
            <button
              type="button"
              class="settings-screen__nav-btn"
              :aria-label="activeSection ? 'К разделам' : 'Назад'"
              :title="activeSection ? 'К разделам' : 'Назад'"
              @click="onNavBack"
            >
              <PixelIcon name="left" variant="small" />
            </button>
            <div>
              <p class="settings-screen__brand">Nonza</p>
              <h1 class="settings-screen__heading">
                {{ activeMeta?.title ?? "Настройки" }}
              </h1>
              <p v-if="!activeSection" class="settings-screen__sub">
                Глобальные настройки приложения
              </p>
            </div>
          </div>
        </header>

        <template v-if="!activeSection">
          <p class="settings-screen__row-label">Разделы</p>
          <div class="settings-screen__grid">
            <MetroTile
              v-for="item in hubSections"
              :key="item.id"
              clickable
              size="rect"
              :variant="item.variant"
              :kicker="item.kicker"
              :title="item.title"
              :subtitle="item.subtitle"
              :mark="item.mark"
              foot="открыть →"
              class="settings-screen__hub-tile"
              @click="openSection(item.id)"
            />
          </div>
        </template>

        <template v-else-if="activeSection === 'profile'">
          <MetroTile
            size="wide"
            variant="dark"
            mark="@"
            class="settings-screen__panel"
          >
            <template #title>Профиль</template>
            <p class="settings-screen__lead">
              Имя видно участникам в комнатах. Email меняется только через поддержку.
            </p>
            <form class="settings-screen__form" @submit.prevent="saveProfile">
              <label class="settings-screen__label">
                Имя
                <Input
                  v-model="nameEdit"
                  placeholder="Введите имя"
                  autocomplete="name"
                  aria-label="Имя"
                />
              </label>
              <label class="settings-screen__label">
                Email
                <Input
                  :model-value="user?.email ?? ''"
                  placeholder="—"
                  aria-label="Email"
                  disabled
                />
              </label>
              <div class="settings-screen__actions">
                <Button
                  type="text"
                  variant="primary"
                  size="large"
                  native-type="submit"
                  class="settings-screen__cta"
                  :disabled="saving || !nameDirty"
                >
                  {{ saving ? "Сохранение…" : "Сохранить" }}
                </Button>
              </div>
            </form>
          </MetroTile>
        </template>

        <template v-else-if="activeSection === 'media'">
          <div class="settings-screen__panel-card">
            <p class="settings-screen__panel-kicker">медиа</p>
            <h2 class="settings-screen__panel-title">Устройства и звук</h2>
            <p class="settings-screen__lead">
              Микрофон, камера, динамики и звуки уведомлений — для всего приложения.
            </p>
            <AudioSettings class="settings-screen__audio" />
          </div>
        </template>

        <template v-else-if="activeSection === 'meetings'">
          <MetroTile
            size="wide"
            variant="purple"
            mark="…"
            class="settings-screen__panel"
          >
            <template #title>Звонки</template>
            <p class="settings-screen__lead">
              Поведение по умолчанию во всех комнатах. Сюда же позже добавим остальные
              глобальные опции звонка.
            </p>
            <div class="settings-screen__pref-list">
              <div class="settings-screen__pref">
                <div class="settings-screen__pref-text">
                  <span class="settings-screen__pref-title">Озвучивание реплик</span>
                  <span class="settings-screen__pref-hint">
                    Читать текст реплик участников вслух (TTS)
                  </span>
                </div>
                <Switch v-model="replicaTtsEnabled">
                  {{ replicaTtsEnabled ? "Вкл" : "Выкл" }}
                </Switch>
              </div>
            </div>
          </MetroTile>
        </template>

        <template v-else-if="activeSection === 'app'">
          <MetroTile
            size="wide"
            variant="blue"
            mark="↑"
            class="settings-screen__panel"
          >
            <template #title>Приложение</template>
            <p class="settings-screen__lead">
              <template v-if="currentVersion">
                Установлена версия {{ currentVersion }}.
              </template>
              <template v-else>
                Клиент Nonza: обновления и служебные опции.
              </template>
            </p>
            <template v-if="isTauriApp">
              <p
                v-if="update && (update.body || update.version)"
                class="settings-screen__lead"
              >
                {{ update.body || `Доступна версия ${update.version}` }}
              </p>
              <p
                v-else-if="upToDate"
                class="settings-screen__lead settings-screen__lead--muted"
              >
                Текущая версия актуальна.
              </p>
              <p v-if="updateError" class="settings-screen__error">
                {{ updateError }}
              </p>
              <div class="settings-screen__actions">
                <Button
                  type="text"
                  variant="default"
                  size="large"
                  class="settings-screen__cta"
                  :disabled="checking || downloading"
                  @click="check"
                >
                  {{ checking ? "Проверка…" : "Проверить обновления" }}
                </Button>
                <Button
                  v-if="update"
                  type="text"
                  variant="primary"
                  size="large"
                  class="settings-screen__cta"
                  :disabled="downloading"
                  @click="install"
                >
                  {{ downloading ? "Загрузка…" : "Обновить" }}
                </Button>
              </div>
            </template>
            <p v-else class="settings-screen__lead settings-screen__lead--muted">
              В браузере обновления ставятся сами. Десктоп-клиент умеет проверять
              релизы отсюда.
            </p>
          </MetroTile>
        </template>

        <template v-else-if="activeSection === 'account'">
          <MetroTile
            size="wide"
            variant="red"
            mark="×"
            class="settings-screen__panel"
          >
            <template #title>Аккаунт</template>
            <p class="settings-screen__lead">
              Выход сбрасывает сессию на этом устройстве. Для входа снова нужны email
              и пароль (или соцвход).
            </p>
            <div class="settings-screen__actions">
              <Button
                type="text"
                variant="danger"
                size="large"
                class="settings-screen__cta"
                @click="handleLogout"
              >
                Выйти
              </Button>
            </div>
          </MetroTile>
        </template>
      </div>
    </div>
  </ScreenLayout>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from "vue";
import {
  ScreenLayout,
  Button,
  Input,
  MetroTile,
  PixelIcon,
  Switch,
  AudioSettings,
} from "@shared/ui";
import type { MetroTileVariant } from "@shared/ui";
import {
  getAuthState,
  clearAuth,
  updateAuthUser,
  useAppUpdate,
  getReplicaTtsEnabled,
  setReplicaTtsEnabled,
} from "@shared/lib";
import { AuthApi } from "@shared/entities";
import { useApiClient } from "@shared/api";

type SettingsSectionId =
  | "profile"
  | "media"
  | "meetings"
  | "app"
  | "account";

type HubSection = {
  id: SettingsSectionId;
  variant: MetroTileVariant;
  kicker: string;
  title: string;
  subtitle: string;
  mark: string;
};

const hubSections: HubSection[] = [
  {
    id: "profile",
    variant: "dark",
    kicker: "профиль",
    title: "Профиль",
    subtitle: "Имя и email",
    mark: "@",
  },
  {
    id: "media",
    variant: "blue",
    kicker: "медиа",
    title: "Устройства и звук",
    subtitle: "Мик, камера, уведомления",
    mark: "♪",
  },
  {
    id: "meetings",
    variant: "purple",
    kicker: "звонки",
    title: "Звонки",
    subtitle: "Реплики и поведение по умолчанию",
    mark: "…",
  },
  {
    id: "app",
    variant: "green",
    kicker: "клиент",
    title: "Приложение",
    subtitle: "Версия и обновления",
    mark: "↑",
  },
  {
    id: "account",
    variant: "red",
    kicker: "сессия",
    title: "Аккаунт",
    subtitle: "Выход из приложения",
    mark: "×",
  },
];

const apiClient = useApiClient();
const authApi = new AuthApi(apiClient);

const emit = defineEmits<{
  back: [];
  logout: [];
}>();

const activeSection = ref<SettingsSectionId | null>(null);

const activeMeta = computed(
  () => hubSections.find((s) => s.id === activeSection.value) ?? null,
);

const {
  isTauriApp,
  currentVersion,
  checking,
  update,
  upToDate,
  downloading,
  error: updateError,
  loadVersion,
  check,
  install,
} = useAppUpdate();

const user = computed(() => getAuthState()?.user ?? null);
const nameEdit = ref(user.value?.name ?? "");
const saving = ref(false);
const replicaTtsEnabled = ref(getReplicaTtsEnabled());

onMounted(() => {
  loadVersion();
});

watch(
  user,
  (u) => {
    nameEdit.value = u?.name ?? "";
  },
  { immediate: true },
);

watch(replicaTtsEnabled, (v) => {
  setReplicaTtsEnabled(v);
});

const nameDirty = computed(
  () => (user.value?.name ?? "") !== nameEdit.value.trim(),
);

function openSection(id: SettingsSectionId) {
  activeSection.value = id;
}

function onNavBack() {
  if (activeSection.value) {
    activeSection.value = null;
    return;
  }
  emit("back");
}

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
.settings-screen {
  width: 100%;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.settings-screen__shell {
  width: min(960px, 100%);
  margin: 0 auto;
  padding: 20px 16px 32px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-sizing: border-box;
}

.settings-screen__topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.settings-screen__brand-block {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.settings-screen__nav-btn {
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

.settings-screen__nav-btn:hover {
  background: #2e2e2e;
  outline: 3px solid #fff;
  outline-offset: 2px;
}

.settings-screen__brand {
  margin: 0;
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.15rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #81b538;
  line-height: 1;
}

.settings-screen__heading {
  margin: 2px 0 0;
  font-family: "Bebas Neue", sans-serif;
  font-weight: normal;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: clamp(2rem, 5vw, 2.8rem);
  line-height: 0.92;
  color: #fff;
}

.settings-screen__sub {
  margin: 6px 0 0;
  font-size: 0.95rem;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.65);
}

.settings-screen__row-label {
  margin: 8px 0 0;
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
}

.settings-screen__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
  align-items: stretch;
}

.settings-screen__hub-tile {
  min-height: 132px;
}

.settings-screen__panel {
  width: 100% !important;
  height: auto !important;
  min-height: 0 !important;
}

.settings-screen__panel :deep(.metro-tile__inner) {
  gap: 12px;
  padding: 22px 22px 18px;
}

.settings-screen__panel :deep(.metro-tile__title) {
  font-size: clamp(2rem, 4vw, 2.6rem);
  max-width: 85%;
}

.settings-screen__panel :deep(.metro-tile__mark) {
  color: rgba(255, 255, 255, 0.1);
  font-size: clamp(4rem, 12vw, 7rem);
  max-height: none;
  max-width: none;
  overflow: visible;
  top: -0.08em;
  right: -0.02em;
  bottom: auto;
  transform: rotate(-4deg);
  transform-origin: top right;
}

.settings-screen__panel :deep(.metro-tile__body) {
  position: relative;
  z-index: 1;
  gap: 14px;
  width: 100%;
  min-width: 0;
}

.settings-screen__panel-card {
  width: 100%;
  border: 3px solid rgba(255, 255, 255, 0.1);
  background: #222;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.3);
  padding: 20px 18px 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.settings-screen__panel-kicker {
  margin: 0;
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
}

.settings-screen__panel-title {
  margin: 0;
  font-family: "Bebas Neue", sans-serif;
  font-weight: normal;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: clamp(2rem, 4vw, 2.6rem);
  line-height: 0.92;
  color: #fff;
}

.settings-screen__lead {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.82);
}

.settings-screen__lead--muted {
  color: rgba(255, 255, 255, 0.6);
}

.settings-screen__error {
  margin: 0;
  font-size: 0.9rem;
  color: #e2534b;
}

.settings-screen__form {
  display: grid;
  gap: 1rem;
  width: 100%;
  min-width: 0;
}

.settings-screen__label {
  display: grid;
  gap: 0.4rem;
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 8px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.85);
  min-width: 0;
}

.settings-screen__label :deep(.pixel-input),
.settings-screen__label :deep(input) {
  width: 100%;
  height: 52px;
  min-height: 52px;
  font-size: 16px;
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.28);
  border-color: #ffffff22;
  border-top-color: #ffffff38;
  border-left-color: #ffffff38;
  color: #fff;
  box-sizing: border-box;
}

.settings-screen__label :deep(.pixel-input:disabled),
.settings-screen__label :deep(input:disabled) {
  opacity: 0.7;
  cursor: default;
}

.settings-screen__label :deep(.pixel-input:focus) {
  background: rgba(0, 0, 0, 0.42);
  outline: 3px solid #fff;
  outline-offset: 2px;
}

.settings-screen__pref-list {
  display: grid;
  gap: 10px;
  width: 100%;
}

.settings-screen__pref {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.28);
  border: 3px solid rgba(255, 255, 255, 0.12);
  min-width: 0;
}

.settings-screen__pref-text {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.settings-screen__pref-title {
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.25rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #fff;
  line-height: 1;
}

.settings-screen__pref-hint {
  font-size: 0.85rem;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.65);
}

.settings-screen__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: flex-end;
  align-items: center;
  padding-top: 4px;
}

.settings-screen__cta {
  min-height: 52px;
  font-family: "Bebas Neue", sans-serif !important;
  font-size: 1.35rem !important;
  font-weight: normal !important;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 14px 24px !important;
}

.settings-screen__audio {
  margin-top: 4px;
  min-width: 0;
}

.settings-screen__audio :deep(.settings-section-title) {
  font-family: "Bebas Neue", sans-serif;
  font-weight: normal;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 1.35rem;
  color: #fff;
}

.settings-screen__audio :deep(.settings-label) {
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 8px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.75);
}

@media (max-width: 640px) {
  .settings-screen__shell {
    padding: 14px 12px 24px;
    gap: 12px;
  }

  .settings-screen__heading {
    font-size: clamp(1.8rem, 8vw, 2.3rem);
  }

  .settings-screen__grid {
    grid-template-columns: 1fr;
  }

  .settings-screen__panel :deep(.metro-tile__inner),
  .settings-screen__panel-card {
    padding: 16px 14px 14px;
  }

  .settings-screen__pref {
    flex-direction: column;
    align-items: stretch;
  }

  .settings-screen__actions {
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .settings-screen__cta {
    width: 100%;
    justify-content: center;
    min-height: 48px;
  }

  .settings-screen__label :deep(.pixel-input),
  .settings-screen__label :deep(input) {
    height: 48px;
    min-height: 48px;
  }
}
</style>
