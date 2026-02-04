<template>
  <div class="room-created full-page">
    <div class="room-created__container">
      <div class="room-created__icon">
        <PixelIcon name="check" :size="36" />
      </div>
      <h2 class="room-created__title">Комната создана!</h2>
      <p class="room-created__subtitle">{{ room.name }}</p>

      <div class="room-created__code-section">
        <label class="room-created__label">Код комнаты</label>
        <div class="room-created__code">
          <code class="room-created__code-text">{{
            room.short_code || "Н/Д"
          }}</code>
          <button
            class="room-created__copy-button"
            @click="copyCode"
            :class="{ 'room-created__copy-button--copied': copied }"
          >
            <template v-if="copied">
              <PixelIcon name="check" variant="small" class="room-created__copy-icon" />
              Скопировано
            </template>
            <template v-else>Копировать</template>
          </button>
        </div>
        <p class="room-created__hint">
          Поделитесь этим кодом с участниками для присоединения к комнате
        </p>
      </div>

      <div class="room-created__actions">
        <button
          class="room-created__button room-created__button--secondary"
          @click="$emit('close')"
        >
          Закрыть
        </button>
        <button
          class="room-created__button room-created__button--primary"
          @click="$emit('join', room)"
        >
          Присоединиться
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { PixelIcon } from "@shared/ui";
import type { Room } from "@entities/room";

const props = defineProps<{
  room: Room;
}>();

defineEmits<{
  close: [];
  join: [room: Room];
}>();

const copied = ref(false);

const copyCode = async () => {
  if (!props.room.short_code) return;

  try {
    await navigator.clipboard.writeText(props.room.short_code);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (error) {
    console.error("Failed to copy:", error);
  }
};
</script>

<style scoped>
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

.room-created__copy-button .room-created__copy-icon {
  margin-right: 6px;
  vertical-align: middle;
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

.room-created__code-section {
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

.room-created__code {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.room-created__code-text {
  flex: 1;
  padding: 12px 16px;
  background: #2a2a2a;
  border: 2px solid #444;
  color: #2980b9;
  font-size: 20px;
  font-weight: 600;
  font-family: "Courier New", monospace;
  letter-spacing: 2px;
  text-align: center;
}

.room-created__copy-button {
  padding: 12px 20px;
  min-height: 44px;
  border: 2px solid #2980b9;
  border-radius: 0;
  background: #2980b9;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.3);
  transition: none;
  white-space: nowrap;
}

.room-created__copy-button:hover {
  background: #21618c;
}

.room-created__copy-button:active {
  box-shadow: 1px 1px 0 0 rgba(0, 0, 0, 0.3);
  transform: translate(1px, 1px);
}

.room-created__copy-button--copied {
  background: #4caf50;
  border-color: #45a049;
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

.room-created__button {
  padding: 12px 24px;
  min-height: 44px;
  border: 2px solid;
  border-radius: 0;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: none;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.3);
}

.room-created__button:active {
  box-shadow: 1px 1px 0 0 rgba(0, 0, 0, 0.3);
  transform: translate(1px, 1px);
}

.room-created__button--primary {
  border-color: #c0392b;
  background: #e74c3c;
  color: white;
}

.room-created__button--primary:hover {
  background: #c0392b;
}

.room-created__button--secondary {
  border-color: #555;
  background: #333;
  color: white;
}

.room-created__button--secondary:hover {
  background: #444;
}

@media (max-width: 480px) {
  .room-created__container {
    padding: 20px;
  }

  .room-created__title {
    font-size: 22px;
  }

  .room-created__code {
    flex-direction: column;
    align-items: stretch;
  }

  .room-created__code-text {
    font-size: 18px;
  }

  .room-created__actions {
    flex-direction: column;
  }

  .room-created__button {
    width: 100%;
  }
}
</style>
