<template>
  <ScreenLayout>
    <div class="login-screen auth-stage">
      <MetroTile
        variant="blue"
        size="wide"
        mark="NONZA"
        class="login-screen__tile"
      >
        <template #title>Вход</template>
        <p class="login-screen__lead">
          Войдите, чтобы открыть организации и комнаты.
        </p>
        <form class="login-screen__form" @submit.prevent="submit">
          <label class="login-screen__label">
            Email
            <Input
              v-model="email"
              type="email"
              placeholder="email@example.com"
              autocomplete="email"
            />
          </label>
          <label class="login-screen__label">
            Пароль
            <Input
              v-model="password"
              type="password"
              placeholder="••••••••"
              autocomplete="current-password"
            />
          </label>
          <Alert v-if="error" variant="danger">{{ error }}</Alert>
          <div class="login-screen__social">
            <p class="login-screen__social-sep">или войти через</p>
            <SocialLoginButton
              provider="google"
              label="Google"
              aria-label="Войти через Google"
              @click="startGoogle"
            />
            <SocialLoginButton
              v-if="mandarinshowLoginEnabled"
              provider="mandarinshow"
              label="MandarinShow"
              aria-label="Войти через mandarinshow.ru"
              @click="startMandarinshow"
            />
          </div>
          <div class="login-screen__actions">
            <Button
              type="text"
              variant="default"
              size="large"
              native-type="button"
              class="login-screen__ghost"
              @click="$emit('goRegister')"
            >
              Регистрация
            </Button>
            <Button
              type="text"
              variant="primary"
              size="large"
              native-type="submit"
              class="login-screen__primary"
              :disabled="submitting"
            >
              {{ submitting ? "Вход..." : "Вход" }}
            </Button>
          </div>
        </form>
      </MetroTile>
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
  SocialLoginButton,
} from "@shared/ui";
import { AuthApi } from "@shared/entities";
import { useApiClient } from "@shared/api";
import {
  setAuth,
  useAppConfig,
  buildGoogleLoginUrl,
  buildMandarinshowLoginUrl,
} from "@shared/lib";

const emit = defineEmits<{
  success: [];
  goRegister: [];
}>();

const apiClient = useApiClient();
const authApi = new AuthApi(apiClient);
const { apiBaseURL } = useAppConfig();

/** Включить, когда настроен SSO с mandarinshow.ru */
const mandarinshowLoginEnabled = false;

const email = ref("");
const password = ref("");
const error = ref<string | null>(null);
const submitting = ref(false);

async function submit() {
  if (!email.value.trim() || !password.value) return;
  error.value = null;
  submitting.value = true;
  try {
    const res = await authApi.login({
      email: email.value.trim(),
      password: password.value,
    });
    setAuth(
      res.access_token,
      res.expires_at,
      {
        id: res.user.id,
        email: res.user.email,
        name: res.user.name,
        color: res.user.color,
      },
      res.refresh_token,
      res.refresh_expires_at,
    );
    emit("success");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Ошибка входа";
  } finally {
    submitting.value = false;
  }
}

function startGoogle() {
  window.location.href = buildGoogleLoginUrl(apiBaseURL, "login");
}

function startMandarinshow() {
  window.location.href = buildMandarinshowLoginUrl(apiBaseURL, "login");
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

.login-screen__tile {
  width: min(620px, 100%);
  min-height: 420px;
  overflow: hidden;
}

.login-screen__tile :deep(.metro-tile__inner) {
  gap: 18px;
  padding: 28px 32px 24px;
  overflow: visible;
}

.login-screen__tile :deep(.metro-tile__title) {
  font-size: clamp(2.8rem, 6vw, 3.8rem);
  letter-spacing: 0.03em;
  line-height: 0.9;
  max-width: 85%;
}

.login-screen__tile :deep(.metro-tile__mark) {
  font-size: clamp(5.5rem, 18vw, 9.5rem);
  line-height: 0.9;
  top: -0.14em;
  right: -0.06em;
  bottom: auto;
  left: auto;
  max-width: none;
  max-height: none;
  width: auto;
  height: auto;
  padding: 0;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.12);
  transform: rotate(-4deg);
  transform-origin: top right;
  z-index: 0;
  pointer-events: none;
  overflow: visible;
  white-space: nowrap;
}

.login-screen__tile :deep(.metro-tile__body) {
  position: relative;
  z-index: 2;
  margin-top: 8px;
  gap: 18px;
  overflow: visible;
  min-width: 0;
}

.login-screen__lead {
  margin: 0;
  max-width: 28rem;
  font-size: 1rem;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.82);
}

.login-screen__form {
  display: grid;
  gap: 1.1rem;
  width: 100%;
  min-width: 0;
}

.login-screen__label {
  display: grid;
  gap: 0.45rem;
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 9px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.85);
  min-width: 0;
}

.login-screen__label :deep(.pixel-input),
.login-screen__label :deep(input) {
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

.login-screen__label :deep(.pixel-input:hover) {
  background: rgba(0, 0, 0, 0.36);
}

.login-screen__label :deep(.pixel-input:focus) {
  background: rgba(0, 0, 0, 0.42);
  outline: 3px solid #fff;
  outline-offset: 2px;
}

.login-screen__social {
  display: grid;
  gap: 12px;
  margin-top: 8px;
  padding-top: 16px;
  border-top: 2px solid rgba(255, 255, 255, 0.12);
  position: relative;
  z-index: 1;
  min-width: 0;
}

.login-screen__social-sep {
  margin: 0 0 2px;
  padding: 0;
  text-align: center;
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 8px;
  line-height: 1.6;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
}

.login-screen__social :deep(.social-login-btn) {
  position: relative;
  z-index: 1;
  margin: 0;
  max-width: 100%;
}

.login-screen__actions {
  display: flex;
  flex-flow: row wrap;
  gap: 14px;
  justify-content: flex-end;
  align-items: center;
  min-width: 0;
  padding-top: 10px;
  margin-top: 4px;
}

.login-screen__actions :deep(.button--text) {
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

.login-screen__ghost :deep(.button),
.login-screen__actions :deep(.button--default) {
  background: #222;
}

@media (max-width: 640px) {
  .auth-stage {
    min-height: 0;
    place-items: stretch;
    padding: 0;
    width: 100%;
  }

  .login-screen__tile {
    width: 100%;
    min-height: 0;
  }

  .login-screen__tile :deep(.metro-tile__inner) {
    padding: 20px 16px 16px;
    gap: 14px;
  }

  .login-screen__tile :deep(.metro-tile__title) {
    font-size: clamp(2.2rem, 10vw, 2.8rem);
    max-width: 100%;
  }

  .login-screen__lead {
    font-size: 0.92rem;
  }

  .login-screen__form {
    gap: 0.9rem;
  }

  .login-screen__label :deep(.pixel-input),
  .login-screen__label :deep(input) {
    height: 48px;
    min-height: 48px;
    font-size: 16px;
    padding: 12px 14px;
  }

  .login-screen__social {
    gap: 10px;
    margin-top: 4px;
    padding-top: 12px;
  }

  .login-screen__actions {
    flex-direction: column-reverse;
    align-items: stretch;
    gap: 10px;
  }

  .login-screen__actions :deep(.button--text) {
    width: 100%;
    justify-content: center;
    min-height: 48px;
    font-size: 1.35rem;
    padding: 14px 20px;
  }
}
</style>
