<template>
  <div class="create-room-form">
    <div class="create-room-form__header">
      <h2 class="create-room-form__title">Создать комнату</h2>
    </div>

    <form @submit.prevent="handleSubmit" class="create-room-form__content">
      <div class="create-room-form__input-group">
        <label for="roomName" class="create-room-form__label">
          Название комнаты <span class="required">*</span>
        </label>
        <input
          id="roomName"
          v-model="formData.name"
          type="text"
          placeholder="Введите название комнаты"
          class="create-room-form__input"
          required
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
            @click="formData.room_type = type.value as RoomType"
          >
            <div class="room-type-card__icon">{{ type.icon }}</div>
            <div class="room-type-card__content">
              <h3 class="room-type-card__title">{{ type.title }}</h3>
              <p class="room-type-card__description">{{ type.description }}</p>
            </div>
            <div class="room-type-card__check">
              <span v-if="formData.room_type === type.value">✓</span>
            </div>
          </div>
        </div>
      </div>

      <div class="create-room-form__input-group">
        <label class="create-room-form__label">
          <input
            type="checkbox"
            v-model="formData.e2ee_enabled"
            class="create-room-form__checkbox checkbox-pixel"
          />
          End-to-End шифрование (E2EE)
        </label>
        <p class="create-room-form__hint">
          Медиа и данные в комнате шифруются между участниками; сервер не имеет
          доступа к ключам
        </p>
      </div>

      <div class="create-room-form__input-group">
        <label class="create-room-form__label">
          <input
            type="checkbox"
            v-model="formData.is_temporary"
            class="create-room-form__checkbox checkbox-pixel"
          />
          Временная комната
        </label>
        <p class="create-room-form__hint">
          Временные комнаты автоматически истекают и идеальны для быстрых встреч
        </p>
      </div>

      <div v-if="formData.is_temporary" class="create-room-form__input-group">
        <label for="expiresIn" class="create-room-form__label">
          Истекает через (необязательно)
        </label>
        <PixelSelect
          id="expiresIn"
          :model-value="formData.expires_in ?? ''"
          placeholder="Никогда"
          :options="expiresInOptions"
          class="create-room-form__select"
          @update:model-value="(v) => (formData.expires_in = v)"
        />
      </div>

      <div v-if="error" class="create-room-form__error">
        {{ error }}
      </div>

      <div class="create-room-form__actions">
        <button
          type="button"
          class="create-room-form__button create-room-form__button--secondary"
          @click="$emit('cancel')"
        >
          Отмена
        </button>
        <button
          type="submit"
          class="create-room-form__button create-room-form__button--primary"
          :disabled="!canSubmit || isSubmitting"
        >
          {{ isSubmitting ? "Создание..." : "Создать комнату" }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { CreateRoomRequest } from "@entities/room";
import type { RoomType } from "@shared/lib";
import { PixelSelect } from "@shared/ui";

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

const formData = ref<CreateRoomRequest & { expires_in?: string }>({
  name: "",
  room_type: "conference_hall" as RoomType,
  is_temporary: true,
  expires_in: "",
  e2ee_enabled: true,
});

const error = ref<string | null>(null);
const isSubmitting = ref(false);

// Expose error handling to parent
defineExpose({
  setError: (err: string) => {
    error.value = err;
    isSubmitting.value = false;
  },
});

const roomTypes = [
  {
    value: "conference_hall",
    title: "Конференц-зал",
    icon: "🎤",
    description:
      "Один основной спикер, остальные в сетке. Идеально для вебинаров, лекций и презентаций.",
  },
  {
    value: "round_table",
    title: "Круглый стол",
    icon: "👥",
    description:
      "Равноправные участники в круге. Подходит для командных встреч, обсуждений и совместной работы.",
  },
];

const canSubmit = computed(() => {
  return (
    formData.value.name.trim().length > 0 && formData.value.room_type.length > 0
  );
});

const handleSubmit = async () => {
  if (!canSubmit.value) return;

  error.value = null;
  isSubmitting.value = true;

  try {
    const submitData: CreateRoomRequest = {
      name: formData.value.name.trim(),
      room_type: formData.value.room_type,
      is_temporary: formData.value.is_temporary,
      expires_in: formData.value.expires_in || undefined,
      e2ee_enabled: formData.value.e2ee_enabled ?? false,
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
  color: #e74c3c;
}

.create-room-form__input {
  width: 100%;
  padding: 12px;
  border: 2px solid #444;
  border-radius: 0;
  background: #1a1a1a;
  color: white;
  font-size: 16px;
  outline: none;
  transition: none;
  box-sizing: border-box;
  appearance: none;
  -webkit-appearance: none;
}

.create-room-form__input:focus {
  border-color: #2980b9;
  box-shadow: inset 0 0 0 2px #2980b9;
}

.create-room-form__select {
  width: 100%;
}

.create-room-form__checkbox {
  margin-right: 8px;
}

.create-room-form__hint {
  margin-top: 8px;
  font-size: 12px;
  color: #999;
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

.room-type-card__check {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #444;
  background: #1a1a1a;
  flex-shrink: 0;
  font-size: 16px;
  color: white;
}

.room-type-card--selected .room-type-card__check {
  border-color: #2980b9;
  background: #2980b9;
  color: white;
}

.create-room-form__error {
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(231, 76, 60, 0.2);
  border: 2px solid #e74c3c;
  color: #e74c3c;
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

.create-room-form__button {
  min-height: 44px;
  padding: 12px 24px;
  border: 2px solid;
  border-radius: 0;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: none;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.3);
  box-sizing: border-box;
}

.create-room-form__button:active:not(:disabled) {
  box-shadow: 1px 1px 0 0 rgba(0, 0, 0, 0.3);
  transform: translate(1px, 1px);
}

.create-room-form__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.create-room-form__button--primary {
  border-color: #c0392b;
  background: #e74c3c;
  color: white;
}

.create-room-form__button--primary:hover:not(:disabled) {
  background: #c0392b;
}

.create-room-form__button--secondary {
  border-color: #555;
  background: #333;
  color: white;
}

.create-room-form__button--secondary:hover:not(:disabled) {
  background: #444;
}

@media (max-width: 480px) {
  .create-room-form__header {
    padding: 16px;
  }

  .create-room-form__title {
    font-size: 20px;
  }

  .create-room-form__content {
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

  .create-room-form__button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
