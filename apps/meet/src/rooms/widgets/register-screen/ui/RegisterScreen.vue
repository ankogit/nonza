<template>
  <ScreenLayout narrow>
    <div class="register-screen__wrap">
      <div class="register-screen__logo-circle">
        <AppLogo variant="withBackground" size="medium" circle />
      </div>
      <div class="register-screen__card">
        <PageHeader title="Регистрация" />
      <form @submit.prevent="submit" class="register-screen__form">
        <FormSection label="Имя">
          <div class="register-screen__name-row">
            <Input
              v-model="name"
              type="text"
              placeholder="Введите имя"
              autocomplete="name"
            />
            <Button
              type="icon"
              variant="default"
              size="small"
              class="register-screen__randomize-btn"
              title="Сгенерировать случайное имя"
              aria-label="Сгенерировать случайное имя"
              @click="randomizeName"
            >
              <PixelIcon name="reload" variant="large" />
            </Button>
          </div>
        </FormSection>
        <FormSection label="Email">
          <Input
            v-model="email"
            type="email"
            placeholder="email@example.com"
            autocomplete="email"
          />
        </FormSection>
        <FormSection label="Пароль" hint="Не менее 6 символов">
          <Input
            v-model="password"
            type="password"
            placeholder="Пароль"
            autocomplete="new-password"
          />
        </FormSection>
        <Alert v-if="error" variant="danger">{{ error }}</Alert>
        <div class="register-screen__actions">
          <Button
            type="text"
            variant="default"
            size="medium"
            native-type="button"
            @click="$emit('goLogin')"
          >
            Вход
          </Button>
          <Button
            type="text"
            variant="secondary"
            size="medium"
            native-type="submit"
            :disabled="submitting || password.length < 6 || !name.trim()"
          >
            {{ submitting ? "Регистрация..." : "Зарегистрироваться" }}
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
  PixelIcon,
  AppLogo,
} from "@shared/ui";
import { AuthApi } from "@shared/entities";
import { useApiClient } from "@shared/api";
import { setAuth, generateParticipantName } from "@shared/lib";

const emit = defineEmits<{
  success: [];
  goLogin: [];
}>();

const apiClient = useApiClient();
const authApi = new AuthApi(apiClient);

const email = ref("");
const password = ref("");
const name = ref("");
const error = ref<string | null>(null);
const submitting = ref(false);

function randomizeName() {
  name.value = generateParticipantName();
}

async function submit() {
  if (!email.value.trim() || password.value.length < 6 || !name.value.trim())
    return;
  error.value = null;
  submitting.value = true;
  try {
    const res = await authApi.register({
      email: email.value.trim(),
      password: password.value,
      name: name.value.trim(),
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
    error.value = e instanceof Error ? e.message : "Ошибка регистрации";
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.register-screen__wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.register-screen__logo-circle {
  flex-shrink: 0;
  width: 120px;
  height: 120px;
}

.register-screen__logo-circle :deep(.app-logo) {
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
}

.register-screen__card {
  width: 100%;
  background: #2a2a2a;
  border: 2px solid #444;
  padding: 24px;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.3);
}

.register-screen__form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.register-screen__actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 2px solid #444;
}

.register-screen__name-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.register-screen__name-row :deep(.pixel-input) {
  flex: 1;
  min-width: 0;
}

.register-screen__randomize-btn {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
}
</style>
