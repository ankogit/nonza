<template>
  <ScreenLayout narrow>
    <div class="login-screen__wrap">
      <div class="login-screen__logo-circle">
        <AppLogo variant="withBackground" size="medium" circle />
      </div>
      <div class="login-screen__card">
        <PageHeader title="Вход" />
      <form @submit.prevent="submit" class="login-screen__form">
        <FormSection label="Email">
          <Input
            v-model="email"
            type="email"
            placeholder="email@example.com"
            autocomplete="email"
          />
        </FormSection>
        <FormSection label="Пароль">
          <Input
            v-model="password"
            type="password"
            placeholder="Пароль"
            autocomplete="current-password"
          />
        </FormSection>
        <Alert v-if="error" variant="danger">{{ error }}</Alert>
        <div class="login-screen__actions">
          <Button
            type="text"
            variant="default"
            size="medium"
            native-type="button"
            @click="$emit('goRegister')"
          >
            Регистрация
          </Button>
          <Button
            type="text"
            variant="primary"
            size="medium"
            native-type="submit"
            :disabled="submitting"
          >
            {{ submitting ? "Вход..." : "Войти" }}
          </Button>
        </div>
      </form>
      </div>
    </div>
  </ScreenLayout>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  ScreenLayout,
  PageHeader,
  FormSection,
  Input,
  Button,
  Alert,
  AppLogo,
} from "@shared/ui";
import { AuthApi } from "@shared/entities";
import { useApiClient } from "@shared/api";
import { setAuth } from "@shared/lib";

const emit = defineEmits<{
  success: [];
  goRegister: [];
}>();

const apiClient = useApiClient();
const authApi = new AuthApi(apiClient);

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
</script>

<style scoped>
.login-screen__wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.login-screen__logo-circle {
  flex-shrink: 0;
  width: 120px;
  height: 120px;
}

.login-screen__logo-circle :deep(.app-logo) {
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
}

.login-screen__card {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  background: #2a2a2a;
  border: 2px solid #444;
  padding: 24px;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.3);
}

.login-screen__form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

.login-screen__actions {
  display: flex;
  flex-flow: row wrap;
  gap: 12px;
  justify-content: flex-end;
  align-items: center;
  min-width: 0;
  padding-top: 16px;
  border-top: 2px solid #444;
}

.login-screen__actions :deep(.button--text) {
  max-width: 100%;
  flex: 0 1 auto;
  min-width: 0;
  text-align: center;
  white-space: normal;
  overflow-wrap: break-word;
}

@media (max-width: 480px) {
  .login-screen__card {
    padding: 16px;
  }

  .login-screen__actions {
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .login-screen__actions :deep(.button--text) {
    width: 100%;
    justify-content: center;
  }
}
</style>
