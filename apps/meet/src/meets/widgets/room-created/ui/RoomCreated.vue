<template>
  <div class="room-created">
    <div class="room-created__shell">
      <header class="room-created__header">
        <h1 class="room-created__heading">Готово</h1>
        <p class="room-created__lead">{{ room.name }}</p>
      </header>

      <MetroTile
        size="wide"
        variant="green"
        class="room-created__tile"
        title="Ссылка"
        kicker="поделиться"
      >
        <label class="room-created__label" for="roomCreatedLink">
          Для участников
          <Input
            id="roomCreatedLink"
            :model-value="joinLink || ''"
            readonly
            class="room-created__input"
            aria-label="Ссылка для подключения"
          />
        </label>
        <Button
          type="text"
          variant="secondary"
          size="large"
          class="room-created__copy"
          :aria-label="copied ? 'Скопировано' : 'Копировать ссылку'"
          @click="copyLink"
        >
          <template v-if="copied">Скопировано</template>
          <template v-else>Копировать</template>
        </Button>
      </MetroTile>

      <div class="room-created__actions">
        <Button
          type="text"
          variant="default"
          size="large"
          class="room-created__btn"
          @click="$emit('close')"
        >
          Назад
        </Button>
        <Button
          type="text"
          variant="primary"
          size="large"
          class="room-created__btn"
          @click="$emit('join', room)"
        >
          Войти
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { Button, Input, MetroTile } from "@shared/ui";
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
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: safe center;
  justify-content: center;
  padding: 20px 16px 28px;
  overflow-y: auto;
  box-sizing: border-box;
}

.room-created__shell {
  width: min(920px, 100%);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.room-created__heading {
  margin: 0;
  font-family: "Bebas Neue", sans-serif;
  font-weight: normal;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: clamp(2.2rem, 5vw, 3.2rem);
  line-height: 0.92;
  color: #fff;
}

.room-created__lead {
  margin: 8px 0 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.95rem;
  line-height: 1.4;
}

.room-created__tile {
  width: 100% !important;
  height: auto !important;
  min-height: 0;
}

.room-created__tile :deep(.metro-tile__inner) {
  gap: 12px;
  padding: 18px 18px 16px;
}

.room-created__tile :deep(.metro-tile__title) {
  margin-top: 0;
  max-width: 100%;
  font-size: clamp(1.55rem, 3vw, 2rem);
}

.room-created__tile :deep(.metro-tile__body) {
  margin-top: 0;
  gap: 12px;
  max-width: 100%;
}

.room-created__label {
  display: grid;
  gap: 0.4rem;
  width: 100%;
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 8px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.85);
}

.room-created__input {
  width: 100%;
}

.room-created__label :deep(.pixel-input) {
  width: 100%;
  height: 52px;
  min-height: 52px;
  font-size: 15px;
  background: rgba(0, 0, 0, 0.28);
  border-color: #ffffff22;
  border-top-color: #ffffff38;
  border-left-color: #ffffff38;
  color: #fff;
}

.room-created__copy {
  align-self: flex-start;
  min-height: 48px;
  font-family: "Bebas Neue", sans-serif !important;
  font-size: 1.35rem !important;
  font-weight: normal !important;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 12px 20px !important;
}

.room-created__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 4px;
}

.room-created__btn {
  min-height: 52px;
  font-family: "Bebas Neue", sans-serif !important;
  font-size: 1.45rem !important;
  font-weight: normal !important;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1;
  padding: 14px 24px !important;
}

@media (max-width: 720px) {
  .room-created {
    align-items: stretch;
    padding: 16px 12px 24px;
  }

  .room-created__shell {
    width: 100%;
  }

  .room-created__actions {
    flex-direction: column-reverse;
  }

  .room-created__btn,
  .room-created__copy {
    width: 100%;
    justify-content: center;
  }
}
</style>
