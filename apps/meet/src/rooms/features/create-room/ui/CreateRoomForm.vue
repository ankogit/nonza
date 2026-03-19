<template>
  <div class="create-room-form">
    <div v-if="!hideHeader" class="create-room-form__header">
      <h2 class="create-room-form__title">Создать комнату</h2>
    </div>
    <form @submit.prevent="submit" class="create-room-form__content">
      <div class="create-room-form__input-group">
        <label for="roomName" class="create-room-form__label">Название комнаты <span class="required">*</span></label>
        <Input
          id="roomName"
          v-model.trim="formData.name"
          placeholder="Например: Стендап команды"
          maxlength="200"
          autocomplete="off"
        />
      </div>
      <div v-if="roomGroupOptions.length" class="create-room-form__input-group">
        <label class="create-room-form__label">Группа</label>
        <p v-if="initialGroupName" class="create-room-form__group-hint">
          Комната будет в группе «{{ initialGroupName }}». Можно изменить ниже.
        </p>
        <PixelSelect
          :model-value="formData.room_group_id"
          :options="roomGroupOptions"
          aria-label="Группа"
          @update:model-value="formData.room_group_id = $event"
        />
      </div>
      <div class="create-room-form__input-group">
        <label class="create-room-form__label">Тип комнаты</label>
        <div class="create-room-form__room-types">
          <div
            v-for="type in roomTypes"
            :key="type.value"
            class="room-type-card"
            :class="{ 'room-type-card--selected': formData.room_type === type.value }"
            @click="formData.room_type = type.value"
          >
            <div class="room-type-card__icon">
              <PixelIcon :name="type.iconName" variant="large" />
            </div>
            <div class="room-type-card__content">
              <h3 class="room-type-card__title">{{ type.title }}</h3>
            </div>
            <div
              class="check-box"
              :class="{ 'check-box--checked': formData.room_type === type.value }"
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
        <Checkbox v-model="formData.e2ee_enabled">E2EE</Checkbox>
      </div>
      <div class="create-room-form__input-group">
        <Checkbox v-model="formData.allow_anonymous_join">Публичная комната</Checkbox>
      </div>
      <div
        v-if="formData.allow_anonymous_join"
        class="create-room-form__input-group"
      >
        <label for="roomPassword" class="create-room-form__label">Пароль комнаты</label>
        <Input
          id="roomPassword"
          v-model.trim="formData.password"
          type="password"
          placeholder="Новый пароль или пусто"
          autocomplete="new-password"
        />
        <p class="create-room-form__hint">
          Пароль необязателен: можно создать публичную комнату без пароля.
        </p>
      </div>
      <div class="create-room-form__input-group">
        <Checkbox v-model="formData.is_temporary">Временная комната</Checkbox>
      </div>
      <div v-if="formData.is_temporary" class="create-room-form__input-group">
        <label for="expiresIn" class="create-room-form__label">Истекает через (необязательно)</label>
        <PixelSelect
          id="expiresIn"
          :model-value="formData.expires_in"
          placeholder="Никогда"
          :options="expiresInOptions"
          @update:model-value="(v) => (formData.expires_in = v)"
        />
      </div>
      <div v-if="error" class="create-room-form__error">{{ error }}</div>
      <div class="create-room-form__actions">
        <Button type="text" variant="default" size="medium" @click="$emit('cancel')">
          Отмена
        </Button>
        <Button
          type="text"
          variant="primary"
          size="medium"
          :disabled="submitting || !formData.name.trim()"
          native-type="submit"
        >
          {{ submitting ? "Создание..." : "Создать комнату" }}
        </Button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { RoomApi } from "@shared/entities";
import { useApiClient } from "@shared/api";
import type { Room, RoomGroup } from "@shared/entities";
import type { RoomType } from "@shared/lib";
import { Button, PixelIcon, Checkbox, Input, PixelSelect } from "@shared/ui";
import type { PixelSelectOption } from "@shared/ui";

const props = defineProps<{
  orgId: string;
  hideHeader?: boolean;
  roomGroups?: RoomGroup[];
  initialGroupId?: string | null;
}>();
const emit = defineEmits<{ created: [room: Room]; cancel: [] }>();

const apiClient = useApiClient();
const roomApi = new RoomApi(apiClient);

const roomTypes: { value: RoomType; title: string; iconName: "conference" | "round-table" | "people" }[] = [
  { value: "round_table", title: "Круглый стол", iconName: "round-table" },
  { value: "conference_hall", title: "Конференц-зал", iconName: "conference" },
  { value: "table_circle", title: "Игровой круг", iconName: "people" },
];

const expiresInOptions = [
  { value: "", label: "Никогда" },
  { value: "15m", label: "15 минут" },
  { value: "30m", label: "30 минут" },
  { value: "1h", label: "1 час" },
  { value: "2h", label: "2 часа" },
  { value: "6h", label: "6 часов" },
  { value: "24h", label: "24 часа" },
];

const formData = ref<{
  name: string;
  room_type: RoomType;
  e2ee_enabled: boolean;
  allow_anonymous_join: boolean;
  password: string;
  is_temporary: boolean;
  expires_in: string;
  room_group_id: string;
}>({
  name: "",
  room_type: "round_table",
  e2ee_enabled: true,
  allow_anonymous_join: false,
  password: "",
  is_temporary: false,
  expires_in: "",
  room_group_id: "",
});

const roomGroupOptions = computed<PixelSelectOption[]>(() => {
  const groups = props.roomGroups ?? [];
  return [
    { value: "", label: "Без группы" },
    ...groups.map((g) => ({ value: g.id, label: g.name })),
  ];
});

const initialGroupName = computed(() => {
  if (!props.initialGroupId) return null;
  const g = (props.roomGroups ?? []).find((x) => x.id === props.initialGroupId);
  return g?.name ?? null;
});

watch(
  () => props.initialGroupId,
  (id) => {
    formData.value.room_group_id = id ?? "";
  },
  { immediate: true },
);
const error = ref<string | null>(null);
const submitting = ref(false);

async function submit() {
  if (!formData.value.name.trim()) {
    error.value = "Укажите название комнаты";
    return;
  }
  error.value = null;
  submitting.value = true;
  try {
    const room = await roomApi.create(props.orgId, {
      name: formData.value.name.trim(),
      room_type: formData.value.room_type,
      is_temporary: formData.value.is_temporary,
      e2ee_enabled: formData.value.e2ee_enabled,
      allow_anonymous_join: formData.value.allow_anonymous_join,
      password: formData.value.allow_anonymous_join
        ? formData.value.password.trim() || undefined
        : undefined,
      expires_in: formData.value.is_temporary
        ? formData.value.expires_in || undefined
        : undefined,
      room_group_id: formData.value.room_group_id || null,
    });
    emit("created", room);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Не удалось создать комнату";
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.create-room-form {
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
  color: #fff;
}

.create-room-form__content {
  padding: 24px;
}

.create-room-form__input-group {
  margin-bottom: 20px;
}

.create-room-form__label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #ccc;
}

.create-room-form__group-hint {
  margin: -4px 0 8px 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
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

.create-room-form__select {
  width: 100%;
}

.required {
  color: #e2534b;
}

.create-room-form__room-types {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.room-type-card {
  padding: 12px 16px;
  border: 2px solid #444;
  background: #1a1a1a;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 16px;
}

.room-type-card__icon {
  font-size: 32px;
  flex-shrink: 0;
}

.room-type-card__content {
  flex: 1;
}

.room-type-card:hover {
  border-color: #555;
  background: #222;
}

.room-type-card--selected {
  border-color: #2980b9;
  background: rgba(41, 128, 185, 0.1);
}

.room-type-card__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
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
}

.create-room-form__actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 24px;
  border-top: 2px solid #444;
}
</style>
