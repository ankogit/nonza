<template>
  <div class="room-created" :class="{ 'full-page': !embedded }">
    <div class="room-created__container">
      <div class="room-created__icon" aria-hidden="true">
        <PixelIcon name="check" :size="36" />
      </div>
      <h2 class="room-created__title">Комната создана!</h2>
      <p class="room-created__subtitle">{{ room.name }}</p>

      <section
        class="room-created__link-section"
        aria-labelledby="room-created-link-label"
      >
        <label id="room-created-link-label" class="room-created__label">
          Ссылка для подключения
        </label>
        <div class="room-created__link-row">
          <Input
            :model-value="joinLink || ''"
            readonly
            class="room-created__input"
            aria-label="Ссылка для подключения"
          />
          <Button
            type="text"
            variant="secondary"
            size="small"
            :aria-label="copied ? 'Скопировано' : 'Копировать ссылку'"
            @click="copyLink"
          >
            <template v-if="copied">
              <PixelIcon name="check" :size="14" />
              Скопировано
            </template>
            <template v-else>Копировать ссылку</template>
          </Button>
        </div>
        <p class="room-created__hint">
          Поделитесь ссылкой с участниками для присоединения к комнате
        </p>
      </section>

      <div class="room-created__actions">
        <Button
          type="text"
          variant="default"
          size="medium"
          @click="$emit('close')"
        >
          Закрыть
        </Button>
        <Button
          type="text"
          variant="primary"
          size="medium"
          @click="$emit('join', room)"
        >
          Присоединиться
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { PixelIcon, Button, Input } from "@shared/ui";
import { showToast } from "@shared/lib";
import type { Room } from "@shared/entities";

const props = withDefaults(
  defineProps<{
    room: Room;
    embedded?: boolean;
  }>(),
  { embedded: false },
);

defineEmits<{
  close: [];
  join: [room: Room];
}>();

const COPY_RESET_MS = 2000;
const copied = ref(false);

const joinLink = computed(() => {
  if (!props.room.short_code) return "";
  const base = window.location.origin + window.location.pathname;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}code=${encodeURIComponent(props.room.short_code)}`;
});

async function copyLink() {
  const link = joinLink.value;
  if (!link) return;
  try {
    await navigator.clipboard.writeText(link);
    copied.value = true;
    showToast("Ссылка скопирована", { variant: "success" });
    setTimeout(() => {
      copied.value = false;
    }, COPY_RESET_MS);
  } catch (e) {
    console.error("Copy failed:", e);
  }
}
</script>

<style scoped>
.room-created {
  align-items: center;
}

.room-created:not(.full-page) {
  display: flex;
  justify-content: center;
}

.room-created__container {
  width: 100%;
  max-width: 500px;
  flex-shrink: 0;
  background: #2a2a2a;
  border: 2px solid #444;
  padding: 32px;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.3);
  text-align: center;
}

.room-created__icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  border-radius: 0;
  background: #4caf50;
  color: white;
  font-size: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #45a049;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.3);
}

.room-created__icon .pi {
  filter: brightness(0) invert(1);
}

.room-created__title {
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 600;
  color: white;
}

.room-created__subtitle {
  margin: 0 0 32px 0;
  font-size: 16px;
  color: #999;
}

.room-created__link-section {
  margin-bottom: 32px;
  padding: 24px;
  background: #1a1a1a;
  border: 2px solid #444;
}

.room-created__label {
  display: block;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #ccc;
}

.room-created__link-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.room-created__input {
  flex: 1;
  min-width: 0;
}

.room-created__hint {
  margin: 0;
  font-size: 12px;
  color: #999;
}

.room-created__actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

@media (max-width: 480px) {
  .room-created__container {
    padding: 20px;
  }

  .room-created__title {
    font-size: 22px;
  }

  .room-created__link-row {
    flex-direction: column;
    align-items: stretch;
  }

  .room-created__actions {
    flex-direction: column;
  }
}
</style>
