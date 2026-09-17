<template>
  <ScreenLayout narrow>
    <div class="oauth-authorize__wrap">
      <div v-if="!authenticated" class="oauth-authorize__login">
        <LoginScreen @success="onLoginSuccess" @go-register="emit('goRegister')" />
      </div>
      <div v-else-if="loading" class="oauth-authorize__card">
        <PageHeader title="Авторизация" />
        <p class="oauth-authorize__text">Проверяем приложение…</p>
      </div>
      <div v-else-if="error" class="oauth-authorize__card">
        <PageHeader title="Ошибка" />
        <Alert variant="danger">{{ error }}</Alert>
      </div>
      <div v-else-if="info" class="oauth-authorize__card">
        <PageHeader :title="consentTitle" />
        <p class="oauth-authorize__text">
          Приложение <strong>{{ info.name }}</strong> запрашивает доступ к вашему
          аккаунту Nonza.
        </p>
        <ul v-if="scopeLabels.length" class="oauth-authorize__scopes">
          <li v-for="item in scopeLabels" :key="item">{{ item }}</li>
        </ul>
        <Alert v-if="approveError" variant="danger">{{ approveError }}</Alert>
        <div class="oauth-authorize__actions">
          <Button
            type="text"
            variant="secondary"
            size="medium"
            :disabled="approving"
            @click="onDeny"
          >
            Отмена
          </Button>
          <Button
            type="text"
            variant="primary"
            size="medium"
            :disabled="approving"
            @click="onApprove"
          >
            {{ approving ? "Разрешаем…" : "Разрешить" }}
          </Button>
        </div>
      </div>
    </div>
  </ScreenLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  ScreenLayout,
  PageHeader,
  Button,
  Alert,
} from "@shared/ui";
import LoginScreen from "@rooms/widgets/login-screen/ui/LoginScreen.vue";
import { OAuthApi } from "@shared/entities";
import type { OAuthAuthorizeInfo, OAuthAuthorizeParams } from "@shared/entities";
import { useApiClient } from "@shared/api";
import { isAuthenticated } from "@shared/lib";

const props = defineProps<{
  params: OAuthAuthorizeParams;
}>();

const emit = defineEmits<{
  goRegister: [];
}>();

const apiClient = useApiClient();
const oauthApi = new OAuthApi(apiClient);

const authenticated = ref(isAuthenticated());
const loading = ref(false);
const approving = ref(false);
const error = ref<string | null>(null);
const approveError = ref<string | null>(null);
const info = ref<OAuthAuthorizeInfo | null>(null);
const autoApproved = ref(false);

const consentTitle = computed(() =>
  info.value?.trusted ? "Вход через Nonza" : "Разрешить доступ",
);

const scopeLabels = computed(() => {
  const scopes = info.value?.scopes ?? [];
  return scopes.map((scope) => {
    switch (scope) {
      case "openid":
        return "Идентификатор аккаунта";
      case "profile":
        return "Профиль (имя, email)";
      case "offline_access":
        return "Доступ без повторного входа (refresh token)";
      default:
        return scope;
    }
  });
});

async function loadInfo() {
  loading.value = true;
  error.value = null;
  try {
    info.value = await oauthApi.getAuthorizeInfo(props.params);
    if (info.value.trusted && !autoApproved.value) {
      autoApproved.value = true;
      await onApprove();
    }
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : "Не удалось загрузить данные приложения";
  } finally {
    loading.value = false;
  }
}

async function onApprove() {
  if (!info.value) return;
  approving.value = true;
  approveError.value = null;
  try {
    const result = await oauthApi.approve({
      client_id: props.params.clientId,
      redirect_uri: props.params.redirectUri,
      state: props.params.state,
      scope: props.params.scope || undefined,
      code_challenge: props.params.codeChallenge || undefined,
      code_challenge_method: props.params.codeChallengeMethod || undefined,
    });
    window.location.href = result.redirect_url;
  } catch (e) {
    approveError.value =
      e instanceof Error ? e.message : "Не удалось выдать код авторизации";
    approving.value = false;
  }
}

function onDeny() {
  const url = new URL(props.params.redirectUri);
  url.searchParams.set("error", "access_denied");
  url.searchParams.set("state", props.params.state);
  window.location.href = url.toString();
}

function onLoginSuccess() {
  authenticated.value = true;
  void loadInfo();
}

onMounted(() => {
  if (authenticated.value) {
    void loadInfo();
  }
});
</script>

<style scoped>
.oauth-authorize__wrap {
  width: 100%;
  display: flex;
  justify-content: center;
}

.oauth-authorize__card,
.oauth-authorize__login {
  width: 100%;
  max-width: 420px;
}

.oauth-authorize__text {
  margin: 0 0 16px;
  color: var(--text-secondary, #ccc);
  line-height: 1.5;
}

.oauth-authorize__scopes {
  margin: 0 0 20px;
  padding-left: 20px;
  color: var(--text-secondary, #ccc);
}

.oauth-authorize__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
