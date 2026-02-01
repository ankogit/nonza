<template>
  <div class="nonza-widget" :class="{ 'nonza-widget--connected': isConnected }">
    <div v-if="isReconnecting" class="nonza-widget__reconnecting">
      <div class="nonza-widget__reconnecting-card">
        <p class="nonza-widget__reconnecting-text">Восстанавливаем подключение</p>
        <p class="nonza-widget__reconnecting-hint">Соединение с комнатой было потеряно</p>
        <Button
          type="text"
          variant="accent"
          size="medium"
          :disabled="isConnecting"
          class="nonza-widget__reconnecting-button"
          @click="handleReconnect"
        >
          {{ isConnecting ? "Подключение..." : "Переподключиться" }}
        </Button>
        <div v-if="connectionState.error" class="nonza-widget__error">
          {{ connectionState.error }}
        </div>
      </div>
    </div>
    <div v-else-if="!isConnected" class="nonza-widget__connect">
      <div class="nonza-widget__connect-form">
        <h2 class="nonza-widget__title">Присоединиться к комнате</h2>
        <div class="nonza-widget__input-group nonza-widget__input-group--full">
          <label for="shortCode">Код комнаты</label>
          <input
            id="shortCode"
            v-model="shortCode"
            type="text"
            placeholder="abc-defg-hij"
            class="nonza-widget__input"
          />
        </div>
        <div class="nonza-widget__input-group">
          <label for="participantName">Ваше имя</label>
          <div class="nonza-widget__input-with-button">
            <input
              id="participantName"
              v-model="participantName"
              type="text"
              placeholder="Введите ваше имя"
              class="nonza-widget__input"
            />
            <button
              type="button"
              class="nonza-widget__randomize-button"
              :title="'Сгенерировать случайное имя'"
              @click="handleRandomizeName"
            >
              🎲
            </button>
          </div>
        </div>
        <Button
          type="text"
          variant="accent"
          size="medium"
          :disabled="!canConnect || isConnecting"
          class="nonza-widget__form-button"
          @click="handleConnect"
        >
          {{ isConnecting ? "Подключение..." : "Присоединиться" }}
        </Button>
        <hr class="HR" />
        <Button
          type="text"
          variant="default"
          size="medium"
          class="nonza-widget__form-button"
          @click="handleCreateRoom"
        >
          Создать комнату
        </Button>
        <div v-if="error" class="nonza-widget__error">{{ error }}</div>
      </div>
    </div>

    <div
      v-else-if="room && connectionState.livekitRoom"
      class="nonza-widget__room"
    >
      <RoomConferenceHall
        v-if="room.room_type === 'conference_hall'"
        :room="room"
        :livekit-room="connectionState.livekitRoom as any"
        :local-participant="localParticipant as any"
        :remote-participants="remoteParticipants"
        :get-display-name="getDisplayName"
        :participant-name="participantName"
        :api-base-u-r-l="apiBaseURL"
        :show-document="true"
        @disconnect="handleDisconnect"
        @update:participantName="participantName = $event"
      />
      <RoomRoundTable
        v-else-if="room.room_type === 'round_table'"
        :room="room"
        :livekit-room="connectionState.livekitRoom as any"
        :local-participant="localParticipant as any"
        :remote-participants="remoteParticipants"
        :get-display-name="getDisplayName"
        :participant-name="participantName"
        :api-base-u-r-l="apiBaseURL"
        :show-document="true"
        @disconnect="handleDisconnect"
        @update:participantName="participantName = $event"
      />
      <div v-else class="nonza-widget__unsupported">
        Тип комнаты "{{ room.room_type }}" пока не поддерживается
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRoomConnection } from "@features/room-connection";
import { RoomConferenceHall } from "@widgets/room-conference-hall";
import { RoomRoundTable } from "@widgets/room-round-table";
import { RoomApi } from "@entities/room";
import { Button } from "@shared/ui";
import { ApiClient } from "@shared/api";
import {
  getParticipantName,
  setParticipantName,
  generateParticipantName,
  getRoomShortCode,
  setRoomShortCode,
  clearRoomShortCode,
} from "@shared/lib";
import type { Room as RoomEntity } from "@entities/room";

const props = defineProps<{
  apiBaseURL?: string;
  livekitURL?: string;
  defaultShortCode?: string;
  defaultParticipantName?: string;
}>();

const apiBaseURL = props.apiBaseURL || "http://localhost:8000";
const livekitURL = props.livekitURL || "ws://localhost:7880";

// Get room code from URL if provided
const urlParams = new URLSearchParams(window.location.search);
const urlCode = urlParams.get("code");

const shortCode = ref(props.defaultShortCode || urlCode || "");
const participantName = ref(
  getParticipantName() || props.defaultParticipantName || "",
);

watch(
  participantName,
  (name) => {
    if (name.trim()) setParticipantName(name);
  },
  { immediate: false },
);
const error = ref<string | null>(null);
const room = ref<RoomEntity | null>(null);

const apiClient = new ApiClient({ baseURL: apiBaseURL });
const roomApi = new RoomApi(apiClient);
const {
  state: connectionState,
  localParticipant,
  remoteParticipants,
  getDisplayName,
  connect,
  reconnect,
  disconnect,
} = useRoomConnection(roomApi);

const isConnecting = computed(() => connectionState.value.isConnecting);
const isConnected = computed(() => connectionState.value.isConnected);
const isReconnecting = computed(() => connectionState.value.isReconnecting);

const canConnect = computed(
  () =>
    shortCode.value.trim().length > 0 &&
    participantName.value.trim().length > 0,
);

const handleConnect = async () => {
  if (!canConnect.value) return;

  error.value = null;
  const name = participantName.value.trim();
  const code = shortCode.value.trim();

  try {
    await connect(code, name, livekitURL);
    room.value = connectionState.value.room;
    setRoomShortCode(code);
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "Не удалось подключиться";
  }
};

const handleReconnect = async () => {
  error.value = null;
  try {
    await reconnect();
    room.value = connectionState.value.room;
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "Не удалось переподключиться";
  }
};

const handleDisconnect = async () => {
  await disconnect();
  room.value = null;
  error.value = null;
  clearRoomShortCode();
};

const handleCreateRoom = () => {
  window.location.href = "/?create=true";
};

const handleRandomizeName = () => {
  const name = generateParticipantName();
  participantName.value = name;
  setParticipantName(name);
};

onMounted(() => {
  const savedShortCode = getRoomShortCode()?.trim();
  const savedName = getParticipantName()?.trim();
  if (savedShortCode && savedName) {
    shortCode.value = savedShortCode;
    participantName.value = savedName;
  }
});
</script>

<style scoped>
.nonza-widget {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
  color: white;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

@media (min-width: 768px) and (min-height: 600px) {
  .nonza-widget {
    min-height: 600px;
  }
}

.nonza-widget__reconnecting,
.nonza-widget__connect {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.nonza-widget__reconnecting-card {
  width: 100%;
  max-width: 400px;
  background: var(--color-surface, #2a2a2a);
  padding: 32px;
  border: 2px solid #444;
  border-radius: 0;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.3);
  text-align: center;
}

.nonza-widget__reconnecting-text {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 500;
  color: white;
}

.nonza-widget__reconnecting-hint {
  margin: 0 0 24px 0;
  font-size: 14px;
  color: #999;
}

.nonza-widget__reconnecting-button {
  width: 100%;
}

.nonza-widget__connect-form {
  width: 100%;
  max-width: 400px;
  background: var(--color-surface, #2a2a2a);
  padding: 32px;
  border: 2px solid #444;
  border-radius: 0;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.3);
}

.nonza-widget__title {
  margin: 0 0 24px 0;
  font-size: 24px;
  font-weight: 400;
  font-family: "Bebas Neue", sans-serif;
  text-align: center;
  letter-spacing: 0.02em;
}

.nonza-widget__input-group {
  margin-bottom: 16px;
}

.nonza-widget__input-group--full .nonza-widget__input {
  width: 100%;
  box-sizing: border-box;
}

.nonza-widget__input-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #ccc;
}

.nonza-widget__input-with-button {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.nonza-widget__input {
  flex: 1;
  padding: 8px;
  border: 2px solid #444;
  border-radius: 0;
  background: #1a1a1a;
  color: white;
  font-size: 16px;
  outline: none;
  transition: none;
  width: 100%;
}

.nonza-widget__input:focus {
  border-color: #2980b9;
  box-shadow: inset 0 0 0 2px #2980b9;
}

.nonza-widget__randomize-button {
  width: 44px;
  height: 44px;
  padding: 0;
  border: 2px solid #444;
  border-radius: 0;
  background: #1a1a1a;
  color: white;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: none;
  flex-shrink: 0;
}

.nonza-widget__randomize-button:hover {
  background: #2a2a2a;
  border-color: #2980b9;
}

.nonza-widget__randomize-button:active {
  background: #1a1a1a;
  box-shadow: inset 0 0 0 2px #2980b9;
}

.nonza-widget__form-button {
  width: 100%;
}

.HR {
  background-color: var(--mc-core-grey-4, #444);
  box-shadow: 0 -0.125rem #00000040;
  height: 0.125rem;
  width: 100%;
  margin-top: 1rem;
  margin-bottom: 1rem;
  border: none;
}

.nonza-widget__error {
  margin-top: 16px;
  padding: 12px;
  background: rgba(255, 190, 83, 0.2);
  border: 2px solid var(--color-accent);
  border-radius: 0;
  color: var(--color-accent);
  font-size: 14px;
  text-align: center;
}

.nonza-widget__room {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.nonza-widget__unsupported {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #999;
}
</style>
