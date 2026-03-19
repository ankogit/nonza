<template>
  <div class="create-room-form">
    <div v-if="!_props.hideHeader" class="create-room-form__header">
      <h2 class="create-room-form__title">Создать комнату</h2>
    </div>

    <form @submit.prevent="handleSubmit" class="create-room-form__content">
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
            @click="formData.room_type = type.value as RoomType"
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
          :model-value="formData.is_temporary ?? false"
          class="create-room-form__checkbox-wrap"
          @update:model-value="(v) => (formData.is_temporary = v)"
        >
          Временная комната
        </Checkbox>
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
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { CreateRoomRequest } from "@shared/entities";
import type { RoomType } from "@shared/lib";
import { PixelSelect, PixelIcon, Button, Checkbox, Input } from "@shared/ui";

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

const _props = withDefaults(defineProps<{ hideHeader?: boolean }>(), {
  hideHeader: false,
});

const formData = ref<
  Omit<CreateRoomRequest, "name"> & { name: string; expires_in?: string }
>({
  name: "",
  room_type: "round_table" as RoomType,
  is_temporary: false,
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
    value: "round_table",
    title: "Круглый стол",
    iconName: "round-table" as const,
    description:
      "Равноправные участники в круге. Подходит для командных встреч, обсуждений и совместной работы.",
  },
  {
    value: "conference_hall",
    title: "Конференц-зал",
    iconName: "conference" as const,
    description:
      "Один основной спикер, остальные в сетке. Идеально для вебинаров, лекций и презентаций.",
  },
  {
    value: "table_circle",
    title: "Игровой круг",
    iconName: "people" as const,
    description:
      "Круговой стол с общими инструментами для настолок: центр-стрим, кубики и быстрые действия по соседям.",
  },
];

const canSubmit = computed(
  () => formData.value.name.length > 0 && formData.value.room_type.length > 0,
);

const handleSubmit = async () => {
  if (!canSubmit.value) return;

  error.value = null;
  isSubmitting.value = true;

  try {
    const submitData: CreateRoomRequest = {
      name: formData.value.name,
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
  margin-bottom: 16px;
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
}
</style>
