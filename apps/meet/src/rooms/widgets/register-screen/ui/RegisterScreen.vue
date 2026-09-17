<template>
  <ScreenLayout>
    <div class="register-screen auth-stage">
      <MetroTile
        variant="purple"
        size="wide"
        mark="N"
        class="register-screen__tile"
      >
        <template #kicker>
          <span class="register-screen__brand">Nonza</span>
        </template>
        <template #title>Регистрация</template>
        <p class="register-screen__lead">
          Создайте аккаунт, чтобы присоединяться к организациям.
        </p>
        <form class="register-screen__form" @submit.prevent="submit">
          <label class="register-screen__label">
            Имя
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
                size="medium"
                class="register-screen__randomize-btn"
                title="Сгенерировать случайное имя"
                aria-label="Сгенерировать случайное имя"
                @click="randomizeName"
              >
                <PixelIcon name="reload" variant="large" />
              </Button>
            </div>
          </label>
          <label class="register-screen__label">
            Email
            <Input
              v-model="email"
              type="email"
              placeholder="email@example.com"
              autocomplete="email"
            />
          </label>
          <label class="register-screen__label">
            Пароль
            <Input
              v-model="password"
              type="password"
              placeholder="••••••••"
              autocomplete="new-password"
            />
          </label>
          <span class="register-screen__hint">Не менее 6 символов</span>
          <Alert v-if="error" variant="danger">{{ error }}</Alert>
          <div class="register-screen__actions">
            <Button
              type="text"
              variant="default"
              size="large"
              native-type="button"
              @click="$emit('goLogin')"
            >
              Вход
            </Button>
            <Button
              type="text"
              variant="secondary"
              size="large"
              native-type="submit"
              :disabled="submitting || password.length < 6 || !name.trim()"
            >
              {{ submitting ? "Регистрация..." : "Регистрация" }}
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
  PixelIcon,
  MetroTile,
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
.auth-stage {
  min-height: min(78vh, 760px);
  display: grid;
  place-items: center;
  width: 100%;
  padding: 12px 0 28px;
}

.register-screen__tile {
  width: min(620px, 100%);
  min-height: 480px;
  overflow: hidden;
}

.register-screen__tile :deep(.metro-tile__inner) {
  gap: 18px;
  padding: 28px 32px 24px;
}

.register-screen__tile :deep(.metro-tile__title) {
  font-size: clamp(2.6rem, 5.5vw, 3.5rem);
  letter-spacing: 0.03em;
  line-height: 0.9;
  max-width: 90%;
}

.register-screen__tile :deep(.metro-tile__mark) {
  font-size: clamp(6rem, 16vw, 10rem);
  right: 0.02em;
  bottom: 0.02em;
  max-width: 60%;
  max-height: 55%;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.08);
  transform-origin: bottom right;
}

.register-screen__tile :deep(.metro-tile__body) {
  margin-top: 8px;
  gap: 18px;
}

.register-screen__brand {
  font-family: "Bebas Neue", sans-serif;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-size: 1.35rem;
  color: #81b538;
  opacity: 1;
}

.register-screen__lead {
  margin: 0;
  max-width: 30rem;
  font-size: 1rem;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.82);
}

.register-screen__form {
  display: grid;
  gap: 1.1rem;
  width: 100%;
}

.register-screen__label {
  display: grid;
  gap: 0.45rem;
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 9px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.85);
  min-width: 0;
}

.register-screen__hint {
  font-family: "Open Sans", sans-serif;
  font-size: 13px;
  letter-spacing: 0;
  text-transform: none;
  color: rgba(255, 255, 255, 0.65);
  margin-top: -0.45rem;
}

.register-screen__label :deep(.pixel-input) {
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
}

.register-screen__label :deep(.pixel-input:hover) {
  background: rgba(0, 0, 0, 0.36);
}

.register-screen__label :deep(.pixel-input:focus) {
  background: rgba(0, 0, 0, 0.42);
  outline: 3px solid #fff;
  outline-offset: 2px;
}

.register-screen__name-row {
  display: flex;
  gap: 10px;
  align-items: stretch;
}

.register-screen__name-row :deep(.pixel-input) {
  flex: 1;
  min-width: 0;
}

.register-screen__randomize-btn {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
}

.register-screen__actions {
  display: flex;
  flex-flow: row wrap;
  gap: 14px;
  justify-content: flex-end;
  align-items: center;
  min-width: 0;
  padding-top: 10px;
  margin-top: 4px;
}

.register-screen__actions :deep(.button--text) {
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

@media (max-width: 640px) {
  .auth-stage {
    min-height: auto;
    place-items: stretch;
    padding: 0;
  }

  .register-screen__tile {
    min-height: 0;
  }

  .register-screen__tile :deep(.metro-tile__inner) {
    padding: 22px 18px 18px;
  }

  .register-screen__actions {
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .register-screen__actions :deep(.button--text) {
    width: 100%;
    justify-content: center;
  }
}
</style>
