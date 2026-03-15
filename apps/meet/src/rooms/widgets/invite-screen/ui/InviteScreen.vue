<template>
  <ScreenLayout narrow>
    <PageHeader title="Приглашение в организацию" />
    <div v-if="loading" class="invite-screen__skeleton">
      <Skeleton variant="text" width="70%" :height="22" class="invite-screen__skeleton-title" />
      <Skeleton variant="text" width="100%" :height="16" />
      <Skeleton variant="text" width="90%" :height="16" />
      <div class="invite-screen__skeleton-actions">
        <Skeleton variant="rect" width="100px" :height="36" />
        <Skeleton variant="rect" width="100px" :height="36" />
      </div>
    </div>
    <div v-else-if="error" class="invite-screen__error">
      <p>{{ error }}</p>
      <Button type="text" variant="default" size="medium" @click="$emit('cancel')">
        На главную
      </Button>
    </div>
    <div v-else-if="invite" class="invite-screen__card">
      <p class="invite-screen__org-name">{{ invite.organization_name }}</p>
      <p v-if="!isAuthenticated()" class="invite-screen__hint">
        Войдите в аккаунт, чтобы принять приглашение.
      </p>
      <p v-else class="invite-screen__hint">Вас приглашают в организацию. Принять приглашение?</p>
      <template v-if="isAuthenticated()">
        <form class="invite-screen__form" @submit.prevent="handleAccept">
          <FormSection label="Мой цвет" hint="Необязательно">
            <div class="invite-screen__colors">
              <button
                v-for="c in colorPalette"
                :key="c"
                type="button"
                class="invite-screen__color-btn"
                :class="{ 'invite-screen__color-btn--active': selectedColor === c }"
                :style="{ backgroundColor: c }"
                :title="c"
                aria-label="Выбрать цвет"
                @click="selectedColor = selectedColor === c ? null : c"
              />
            </div>
          </FormSection>
          <div class="invite-screen__form-actions">
            <Button
              type="text"
              variant="default"
              size="medium"
              native-type="button"
              @click="$emit('cancel')"
            >
              Отклонить
            </Button>
            <Button
              type="text"
              variant="primary"
              size="medium"
              native-type="submit"
              :disabled="accepting"
            >
              {{ accepting ? "Принятие..." : "Принять" }}
            </Button>
          </div>
        </form>
      </template>
      <template v-else>
        <div class="invite-screen__actions">
          <Button type="text" variant="primary" size="medium" @click="goToLogin">
            Войти
          </Button>
          <Button type="text" variant="default" size="medium" @click="$emit('cancel')">
            На главную
          </Button>
        </div>
      </template>
    </div>
  </ScreenLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import {
  ScreenLayout,
  PageHeader,
  FormSection,
  Button,
  Skeleton,
} from "@shared/ui";
import { PARTICIPANT_COLOR_PALETTE } from "@shared/lib";
import { InviteApi } from "@shared/entities";
import { useApiClient } from "@shared/api";
import type { Invite } from "@shared/entities";
import { isAuthenticated } from "@shared/lib";

const props = defineProps<{
  token: string;
}>();

const emit = defineEmits<{
  accepted: [orgId: string];
  openOrg: [orgId: string];
  cancel: [];
  goLogin: [];
}>();

const apiClient = useApiClient();
const inviteApi = new InviteApi(apiClient);

const invite = ref<Invite | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const accepting = ref(false);
const selectedColor = ref<string | null>(null);
const colorPalette = [...PARTICIPANT_COLOR_PALETTE];

function goToLogin() {
  emit("goLogin");
}

async function loadInvite() {
  if (!props.token) {
    error.value = "Не указана ссылка приглашения";
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = null;
  invite.value = null;
  try {
    invite.value = await inviteApi.getByToken(props.token);
    if (invite.value?.already_member && isAuthenticated()) {
      emit("openOrg", invite.value.organization_id);
      return;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка загрузки";
    const lower = msg.toLowerCase();
    if (lower.includes("expired") || msg.includes("410")) {
      error.value = "Приглашение истекло";
    } else if (lower.includes("not found") || msg.includes("404")) {
      error.value = "Приглашение не найдено";
    } else {
      error.value = msg;
    }
  } finally {
    loading.value = false;
  }
}

async function handleAccept() {
  if (!invite.value || accepting.value || !isAuthenticated()) return;
  accepting.value = true;
  try {
    await inviteApi.accept(props.token, {
      ...(selectedColor.value && { color: selectedColor.value }),
    });
    emit("accepted", invite.value.organization_id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Не удалось принять приглашение";
  } finally {
    accepting.value = false;
  }
}

onMounted(() => loadInvite());
watch(() => props.token, () => loadInvite());
</script>

<style scoped>
.invite-screen__loading {
  padding: 48px;
  text-align: center;
  color: #999;
}

.invite-screen__skeleton {
  padding: 24px;
  border: 2px solid #444;
  background: #2a2a2a;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.invite-screen__skeleton-title {
  margin-bottom: 4px;
}

.invite-screen__skeleton-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
}

.invite-screen__error {
  padding: 24px;
  border: 2px solid #e2534b;
  background: #2a2a2a;
  color: #fff;
}

.invite-screen__error p {
  margin: 0 0 16px 0;
}

.invite-screen__card {
  padding: 24px;
  border: 2px solid #444;
  background: #2a2a2a;
  color: #fff;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.3);
}

.invite-screen__org-name {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
}

.invite-screen__hint {
  margin: 0 0 24px 0;
  color: #999;
  font-size: 14px;
}

.invite-screen__form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.invite-screen__form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 2px solid #444;
}

.invite-screen__actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.invite-screen__colors {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-top: 0;
}

.invite-screen__color-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid #444;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.3);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}

.invite-screen__color-btn:hover {
  filter: brightness(1.15);
}

.invite-screen__color-btn--active {
  border-color: #fff;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.4);
}
</style>
