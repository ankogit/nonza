<template>
  <div
    class="create-room-form"
    :class="{ 'create-room-form--metro': isMetro }"
  >
    <div v-if="!hideHeader && !isMetro" class="create-room-form__header">
      <h2 class="create-room-form__title">Создать комнату</h2>
    </div>

    <form
      class="create-room-form__content"
      :class="{ 'create-room-form__content--metro': isMetro }"
      @submit.prevent="handleSubmit"
    >
      <template v-if="isMetro">
        <header class="create-room-form__metro-header">
          <h1 class="create-room-form__metro-heading">Создать комнату</h1>
          <p class="create-room-form__metro-lead">
            Название, тип — и можно начинать.
          </p>
        </header>

        <div class="create-room-form__metro-grid">
          <MetroTile
            size="wide"
            variant="purple"
            class="create-room-form__metro-tile create-room-form__metro-name"
          >
            <template #title>Название</template>
            <label class="create-room-form__metro-label" for="roomName">
              Как назвать комнату
              <Input
                id="roomName"
                v-model.trim="formData.name"
                placeholder="Например: Стендап"
                maxlength="200"
                autocomplete="off"
              />
            </label>
          </MetroTile>

          <p class="create-room-form__metro-section">Тип</p>
          <button
            v-for="type in roomTypes"
            :key="type.value"
            type="button"
            class="create-room-form__type-tile"
            :class="[
              `create-room-form__type-tile--${type.tone}`,
              {
                'create-room-form__type-tile--selected':
                  formData.room_type === type.value,
              },
            ]"
            @click="formData.room_type = type.value"
          >
            <span class="create-room-form__type-kicker">{{ type.kicker }}</span>
            <span class="create-room-form__type-icon" aria-hidden="true">
              <PixelIcon :name="type.iconName" variant="large" />
            </span>
            <span class="create-room-form__type-title">{{ type.title }}</span>
            <span class="create-room-form__type-desc">{{ type.short }}</span>
          </button>

          <MetroTile
            size="wide"
            variant="dark"
            class="create-room-form__metro-tile create-room-form__metro-opts"
          >
            <template #title>Опции</template>
            <div class="create-room-form__metro-checks">
              <Checkbox
                :model-value="formData.e2ee_enabled ?? false"
                @update:model-value="(v) => (formData.e2ee_enabled = v)"
              >
                E2EE шифрование
              </Checkbox>
              <Checkbox
                :model-value="passwordEnabled"
                @update:model-value="onPasswordEnabledChange"
              >
                Вход по паролю
              </Checkbox>
              <label
                v-if="passwordEnabled"
                class="create-room-form__metro-label"
                for="roomPasswordMetro"
              >
                Пароль
                <Input
                  id="roomPasswordMetro"
                  v-model.trim="formData.password"
                  type="password"
                  placeholder="Пароль для входа"
                  autocomplete="new-password"
                />
              </label>
              <Checkbox
                :model-value="formData.is_temporary ?? false"
                @update:model-value="(v) => (formData.is_temporary = v)"
              >
                Временная комната
              </Checkbox>
              <PixelSelect
                v-if="formData.is_temporary"
                id="expiresIn"
                :model-value="formData.expires_in ?? ''"
                placeholder="Истекает"
                :options="expiresInOptions"
                class="create-room-form__metro-select"
                @update:model-value="(v) => (formData.expires_in = v)"
              />
            </div>
          </MetroTile>
        </div>

        <div v-if="error" class="create-room-form__error">{{ error }}</div>

        <div class="create-room-form__metro-actions">
          <Button
            type="text"
            variant="default"
            size="large"
            native-type="button"
            class="create-room-form__metro-btn"
            @click="$emit('cancel')"
          >
            Назад
          </Button>
          <Button
            type="text"
            variant="primary"
            size="large"
            native-type="submit"
            class="create-room-form__metro-btn"
            :disabled="!canSubmit || isSubmitting"
          >
            {{ isSubmitting ? "Создание..." : "Создать" }}
          </Button>
        </div>
      </template>

      <template v-else>
        <div class="create-room-form__input-group">
          <label for="roomName" class="create-room-form__label">
            Название комнаты <span class="required">*</span>
          </label>
          <Input
            id="roomName"
            v-model.trim="formData.name"
            placeholder="Например: Стендап команды"
            maxlength="200"
            autocomplete="off"
          />
        </div>

        <div class="create-room-form__input-group">
          <label class="create-room-form__label">
            Тип комнаты <span class="required">*</span>
          </label>
          <div class="create-room-form__room-types">
            <div
              v-for="type in roomTypes"
              :key="type.value"
              class="room-type-card"
              :class="{
                'room-type-card--selected': formData.room_type === type.value,
              }"
              @click="formData.room_type = type.value"
            >
              <div class="room-type-card__icon">
                <PixelIcon :name="type.iconName" variant="large" />
              </div>
              <div class="room-type-card__content">
                <h3 class="room-type-card__title">{{ type.title }}</h3>
                <p class="room-type-card__description">{{ type.description }}</p>
              </div>
              <div
                class="check-box"
                :class="{
                  'check-box--checked': formData.room_type === type.value,
                }"
              >
                <PixelIcon
                  v-if="formData.room_type === type.value"
                  name="check"
                  :size="20"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="create-room-form__input-group">
          <Checkbox
            :model-value="formData.e2ee_enabled ?? false"
            class="create-room-form__checkbox-wrap"
            @update:model-value="(v) => (formData.e2ee_enabled = v)"
          >
            End-to-End шифрование (E2EE)
          </Checkbox>
          <p class="create-room-form__hint">
            Медиа и данные в комнате шифруются между участниками; сервер не имеет
            доступа к ключам
          </p>
        </div>

        <div class="create-room-form__input-group">
          <Checkbox
            :model-value="passwordEnabled"
            class="create-room-form__checkbox-wrap"
            @update:model-value="onPasswordEnabledChange"
          >
            Вход по паролю
          </Checkbox>
          <p class="create-room-form__hint">
            Гости смогут войти только с паролем
          </p>
        </div>

        <div v-if="passwordEnabled" class="create-room-form__input-group">
          <label for="roomPasswordDefault" class="create-room-form__label">
            Пароль <span class="required">*</span>
          </label>
          <Input
            id="roomPasswordDefault"
            v-model.trim="formData.password"
            type="password"
            placeholder="Пароль для входа"
            autocomplete="new-password"
          />
        </div>

        <div class="create-room-form__input-group">
          <Checkbox
            :model-value="formData.is_temporary ?? false"
            class="create-room-form__checkbox-wrap"
            @update:model-value="(v) => (formData.is_temporary = v)"
          >
            Временная комната
          </Checkbox>
          <p class="create-room-form__hint">
            Временные комнаты автоматически истекают и идеальны для быстрых
            встреч
          </p>
        </div>

        <div v-if="formData.is_temporary" class="create-room-form__input-group">
          <label for="expiresInDefault" class="create-room-form__label">
            Истекает через (необязательно)
          </label>
          <PixelSelect
            id="expiresInDefault"
            :model-value="formData.expires_in ?? ''"
            placeholder="Никогда"
            :options="expiresInOptions"
            class="create-room-form__select"
            @update:model-value="(v) => (formData.expires_in = v)"
          />
        </div>

        <div v-if="error" class="create-room-form__error">{{ error }}</div>

        <div class="create-room-form__actions">
          <Button
            type="text"
            variant="default"
            size="medium"
            native-type="button"
            @click="$emit('cancel')"
          >
            Отмена
          </Button>
          <Button
            type="text"
            variant="primary"
            size="medium"
            native-type="submit"
            :disabled="!canSubmit || isSubmitting"
          >
            {{ isSubmitting ? "Создание..." : "Создать комнату" }}
          </Button>
        </div>
      </template>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { CreateRoomRequest } from "@shared/entities";
import type { RoomType } from "@shared/lib";
import {
  PixelSelect,
  PixelIcon,
  Button,
  Checkbox,
  Input,
  MetroTile,
} from "@shared/ui";

const expiresInOptions = [
  { value: "", label: "Никогда" },
  { value: "15m", label: "15 минут" },
  { value: "30m", label: "30 минут" },
  { value: "1h", label: "1 час" },
  { value: "2h", label: "2 часа" },
  { value: "6h", label: "6 часов" },
  { value: "24h", label: "24 часа" },
];

const emit = defineEmits<{
  submit: [data: CreateRoomRequest];
  cancel: [];
}>();

const props = withDefaults(
  defineProps<{
    hideHeader?: boolean;
    variant?: "default" | "metro";
  }>(),
  {
    hideHeader: false,
    variant: "default",
  },
);

const isMetro = computed(() => props.variant === "metro");
const hideHeader = computed(() => props.hideHeader);

const formData = ref<
  Omit<CreateRoomRequest, "name" | "password"> & {
    name: string;
    expires_in?: string;
    password: string;
  }
>({
  name: "",
  room_type: "round_table" as RoomType,
  is_temporary: false,
  expires_in: "",
  e2ee_enabled: true,
  password: "",
});

const passwordEnabled = ref(false);
const error = ref<string | null>(null);
const isSubmitting = ref(false);

defineExpose({
  setError: (err: string) => {
    error.value = err;
    isSubmitting.value = false;
  },
});

function onPasswordEnabledChange(enabled: boolean) {
  passwordEnabled.value = enabled;
  if (!enabled) {
    formData.value.password = "";
  }
}

const roomTypes = [
  {
    value: "round_table" as RoomType,
    title: "Круглый стол",
    kicker: "команда",
    short: "Все равны",
    tone: "blue",
    iconName: "round-table" as const,
    description:
      "Равноправные участники в круге. Подходит для командных встреч, обсуждений и совместной работы.",
  },
  {
    value: "conference_hall" as RoomType,
    title: "Конференц-зал",
    kicker: "спикер",
    short: "Один ведущий",
    tone: "green",
    iconName: "conference" as const,
    description:
      "Один основной спикер, остальные в сетке. Идеально для вебинаров, лекций и презентаций.",
  },
  {
    value: "table_circle" as RoomType,
    title: "Игровой круг",
    kicker: "игра",
    short: "Настолки",
    tone: "gold",
    iconName: "people" as const,
    description:
      "Круговой стол с общими инструментами для настолок: центр-стрим, кубики и быстрые действия по соседям.",
  },
];

const canSubmit = computed(() => {
  if (!formData.value.name.length || !formData.value.room_type.length) {
    return false;
  }
  if (passwordEnabled.value && !formData.value.password.trim()) {
    return false;
  }
  return true;
});

const handleSubmit = async () => {
  if (!canSubmit.value) return;

  error.value = null;
  isSubmitting.value = true;

  try {
    const password = passwordEnabled.value
      ? formData.value.password.trim()
      : "";
    const submitData: CreateRoomRequest = {
      name: formData.value.name,
      room_type: formData.value.room_type,
      is_temporary: formData.value.is_temporary,
      expires_in: formData.value.expires_in || undefined,
      e2ee_enabled: formData.value.e2ee_enabled ?? false,
      ...(password
        ? {
            allow_anonymous_join: true,
            password,
          }
        : {}),
    };

    emit("submit", submitData);
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "Не удалось создать комнату";
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
.create-room-form {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  background: #2a2a2a;
  border: 2px solid #444;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.3);
}

.create-room-form--metro {
  max-width: none;
  margin: 0;
  background: transparent;
  border: none;
  box-shadow: none;
}

.create-room-form__header {
  padding: 24px;
  border-bottom: 2px solid #444;
  background: #1a1a1a;
}

.create-room-form__title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: white;
}

.create-room-form__content {
  padding: 24px;
}

.create-room-form__content--metro {
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.create-room-form__metro-header {
  margin-bottom: 2px;
}

.create-room-form__metro-heading {
  margin: 0;
  font-family: "Bebas Neue", sans-serif;
  font-weight: normal;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: clamp(2.2rem, 5vw, 3.2rem);
  line-height: 0.92;
  color: #fff;
}

.create-room-form__metro-lead {
  margin: 8px 0 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.95rem;
  line-height: 1.4;
}

.create-room-form__metro-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  align-items: stretch;
}

.create-room-form__metro-name,
.create-room-form__metro-opts,
.create-room-form__metro-section {
  grid-column: 1 / -1;
}

.create-room-form__metro-section {
  margin: 4px 0 0;
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #2980b9;
  line-height: 1.5;
}

.create-room-form__metro-tile {
  width: 100% !important;
  height: auto !important;
  min-height: 0;
}

.create-room-form__metro-tile :deep(.metro-tile__inner) {
  gap: 12px;
  padding: 18px 18px 16px;
}

.create-room-form__metro-tile :deep(.metro-tile__title) {
  margin-top: 0;
  max-width: 100%;
  font-size: clamp(1.55rem, 3vw, 2rem);
}

.create-room-form__metro-tile :deep(.metro-tile__body) {
  margin-top: 0;
  width: 100%;
  max-width: 100%;
}

.create-room-form__metro-label {
  display: grid;
  gap: 0.4rem;
  width: 100%;
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 8px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.85);
}

.create-room-form__metro-label :deep(.pixel-input) {
  width: 100%;
  height: 52px;
  min-height: 52px;
  font-size: 16px;
  background: rgba(0, 0, 0, 0.28);
  border-color: #ffffff22;
  border-top-color: #ffffff38;
  border-left-color: #ffffff38;
  color: #fff;
}

.create-room-form__type-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  min-height: 148px;
  padding: 14px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-radius: 0;
  color: #fff;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  filter: drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.3));
  outline: 3px solid transparent;
  outline-offset: 2px;
  transition:
    transform 0.12s ease,
    outline-color 0.12s ease,
    filter 0.12s ease;
  box-sizing: border-box;
  appearance: none;
  font: inherit;
}

.create-room-form__type-tile--blue {
  background: #2980b9;
}

.create-room-form__type-tile--green {
  background: #1f6b4a;
}

.create-room-form__type-tile--gold {
  background: #8a5a12;
  color: #fff7e8;
}

.create-room-form__type-tile:hover {
  transform: scale(1.015);
  outline-color: rgba(255, 255, 255, 0.7);
}

.create-room-form__type-tile--selected {
  outline-color: #fff;
  filter: drop-shadow(4px 4px 0 rgba(0, 0, 0, 0.4));
}

.create-room-form__type-kicker {
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 7px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.8;
}

.create-room-form__type-icon {
  display: flex;
  opacity: 0.9;
}

.create-room-form__type-title {
  margin-top: auto;
  font-family: "Bebas Neue", sans-serif;
  font-size: clamp(1.35rem, 2.4vw, 1.75rem);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 0.95;
}

.create-room-form__type-desc {
  font-size: 0.82rem;
  line-height: 1.3;
  opacity: 0.85;
}

.create-room-form__metro-checks {
  display: grid;
  gap: 12px;
  width: 100%;
}

.create-room-form__metro-select {
  width: 100%;
  max-width: 280px;
}

.create-room-form__metro-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 4px;
}

.create-room-form__metro-btn {
  min-height: 52px;
  font-family: "Bebas Neue", sans-serif !important;
  font-size: 1.45rem !important;
  font-weight: normal !important;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1;
  padding: 14px 24px !important;
}

.create-room-form__input-group {
  margin-bottom: 24px;
}

.create-room-form__label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #ccc;
}

.required {
  color: #e2534b;
}

.create-room-form__select {
  width: 100%;
}

.create-room-form__checkbox-wrap {
  margin-bottom: 4px;
}

.create-room-form__hint {
  margin: 8px 0 0 34px;
  font-size: 12px;
  line-height: 1.4;
  color: #999;
  overflow-wrap: break-word;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.create-room-form__room-types {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.room-type-card {
  position: relative;
  padding: 16px;
  border: 2px solid #444;
  background: #1a1a1a;
  cursor: pointer;
  transition: none;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.3);
}

.room-type-card:hover {
  border-color: #555;
  background: #222;
}

.room-type-card--selected {
  border-color: #2980b9;
  background: rgba(41, 128, 185, 0.1);
  box-shadow: 2px 2px 0 0 #2980b9;
}

.room-type-card__icon {
  font-size: 32px;
  flex-shrink: 0;
}

.room-type-card__content {
  flex: 1;
  min-width: 0;
}

.room-type-card__title {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: white;
}

.room-type-card__description {
  margin: 0;
  font-size: 14px;
  color: #999;
  line-height: 1.4;
}

.create-room-form__room-types :deep(.check-box) {
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
}

.create-room-form__error {
  margin-bottom: 0;
  padding: 12px;
  background: rgba(231, 76, 60, 0.2);
  border: 2px solid #e2534b;
  color: #e2534b;
  font-size: 14px;
  text-align: center;
}

.create-room-form__actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 2px solid #444;
}

@media (max-width: 720px) {
  .create-room-form__metro-grid {
    grid-template-columns: 1fr;
  }

  .create-room-form__type-tile {
    min-height: 120px;
  }

  .create-room-form__metro-actions {
    flex-direction: column-reverse;
  }

  .create-room-form__metro-btn {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .create-room-form__header {
    padding: 16px;
  }

  .create-room-form__title {
    font-size: 20px;
  }

  .create-room-form__content:not(.create-room-form__content--metro) {
    padding: 16px;
  }

  .create-room-form__input-group {
    margin-bottom: 20px;
  }

  .create-room-form__room-types {
    gap: 10px;
  }

  .room-type-card {
    padding: 12px;
    gap: 12px;
    min-height: 44px;
  }

  .room-type-card__icon {
    font-size: 28px;
  }

  .room-type-card__title {
    font-size: 16px;
  }

  .room-type-card__description {
    font-size: 13px;
  }

  .create-room-form__actions {
    flex-direction: column;
    gap: 10px;
    margin-top: 24px;
    padding-top: 20px;
  }
}
</style>
