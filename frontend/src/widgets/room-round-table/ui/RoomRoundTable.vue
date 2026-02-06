<template>
  <div class="dashboard bg-dark grain-overlay">
    <div class="room-header bg-dark-20">
      <div class="room-info color-white font-bebas">
        <h2>Room #{{ room?.short_code ?? room?.id ?? room?.name ?? "—" }}</h2>
      </div>
      <div class="room-indicators">
        <div
          v-if="
            !previewMode &&
            (connectionStatus === 'warning' || connectionStatus === 'bad')
          "
          class="connection-indicator"
          :class="`connection-indicator--${connectionStatus}`"
          :title="connectionLabel"
        >
          <PixelIcon
            :name="
              connectionStatus === 'bad'
                ? 'connection-bad'
                : 'connection-medium'
            "
            variant="small"
          />
          <span class="connection-indicator__label">{{ connectionLabel }}</span>
        </div>
        <E2EEIndicator
          v-if="!previewMode"
          :room="livekitRoom"
          :show-label="true"
        />
        <Button
          variant="default"
          size="small"
          title="Настройки"
          @click="handleSettings"
        >
          <PixelIcon name="settings" variant="large" />
        </Button>
      </div>
    </div>

    <div class="round-table-content">
      <div class="call-grid">
        <VideoParticipant
          v-for="p in roundTableParticipants"
          :key="`${participantsKey}-${p.identity}-${
            props.getDisplayName?.(p) ?? p.name ?? p.identity
          }`"
          :participant="p"
          :participant-name="
            isLocal(p)
              ? props.participantName
              : props.getDisplayName?.(p) ?? p.name ?? p.identity
          "
          :is-speaking="speakingIdentitySet.has(p.identity)"
          :show-full-size="roundTableParticipants.length > 1"
          :replica-text="replicaByParticipant[p.identity]?.text"
          @full-size="() => handleFullSize(p.identity)"
        />
        <template v-if="previewMode && roundTableParticipants.length === 0">
          <VideoParticipant
            :participant="null"
            participant-name="Alice"
            :is-speaking="false"
            :preview-mode="true"
          />
          <VideoParticipant
            :participant="null"
            participant-name="Bob"
            :is-speaking="false"
            :preview-mode="true"
          />
          <VideoParticipant
            :participant="null"
            participant-name="Charlie"
            :is-speaking="false"
            :preview-mode="true"
          />
        </template>
      </div>

      <div
        v-if="props.showDocument"
        v-show="isDocumentOpen"
        class="round-table-document"
        aria-label="Совместный документ"
      >
        <CollaborativeDocument
          :room="props.room"
          :api-base-u-r-l="props.apiBaseURL"
          :participant-name="props.participantName"
        />
      </div>
    </div>

    <div class="menu bg-dark-20">
      <div class="left">
        <Button
          :class="{
            active: mediaState.isAudioEnabled,
            default: !mediaState.isAudioEnabled,
          }"
          :title="
            mediaState.isAudioEnabled
              ? 'Выключить микрофон'
              : 'Включить микрофон'
          "
          @click="toggleAudio"
        >
          <PixelIcon
            :name="mediaState.isAudioEnabled ? 'mic-on' : 'mic-off'"
            variant="large"
          />
        </Button>
        <Button
          :class="{
            active: mediaState.isVideoEnabled,
            default: !mediaState.isVideoEnabled,
          }"
          :title="
            mediaState.isVideoEnabled ? 'Выключить видео' : 'Включить видео'
          "
          @click="toggleVideo"
        >
          <PixelIcon
            :name="mediaState.isVideoEnabled ? 'video-on' : 'video-off'"
            variant="large"
          />
        </Button>
        <Button
          v-if="!previewMode"
          :class="{
            active: mediaState.isScreenSharing,
            default: !mediaState.isScreenSharing,
          }"
          title="Трансляция экрана"
          @click="toggleScreenShare"
        >
          <PixelIcon
            :name="mediaState.isScreenSharing ? 'screen-on' : 'screen-off'"
            variant="large"
          />
        </Button>
        <ReplicaInput v-if="!previewMode" @submit="sendReplica" />
      </div>
      <div class="center">
        <Button
          variant="danger"
          title="Закончить разговор"
          @click="handleDisconnect"
        >
          <PixelIcon name="hangup" variant="large" />
        </Button>
      </div>
      <div class="right">
        <Button
          v-if="props.showDocument"
          variant="default"
          :class="{ active: isDocumentOpen }"
          :title="isDocumentOpen ? 'Скрыть документ' : 'Совместный документ'"
          @click="toggleDocument"
        >
          <PixelIcon name="document" variant="large" />
        </Button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="fullscreenParticipant"
        class="round-table-fullscreen"
        role="dialog"
        aria-label="Во весь экран"
        @click.self="closeFullscreen"
      >
        <div class="round-table-fullscreen__video">
          <VideoParticipant
            :participant="fullscreenParticipant"
            :participant-name="
              isLocal(fullscreenParticipant)
                ? props.participantName
                : props.getDisplayName?.(fullscreenParticipant) ??
                  fullscreenParticipant.name ??
                  fullscreenParticipant.identity
            "
            :is-speaking="
              fullscreenParticipant
                ? speakingIdentitySet.has(fullscreenParticipant.identity)
                : false
            "
            :replica-text="
              fullscreenParticipant
                ? replicaByParticipant[fullscreenParticipant.identity]?.text
                : undefined
            "
          />
        </div>
        <Button
          variant="default"
          class="round-table-fullscreen__close"
          title="Закрыть"
          aria-label="Закрыть"
          @click="closeFullscreen"
        >
          <PixelIcon name="close" variant="large" />
        </Button>
      </div>
    </Teleport>

    <Modal
      v-model="isSettingsOpen"
      title="Настройки"
      :close-on-overlay-click="!hasUnsavedSettingsChanges"
      @close="handleModalClose"
    >
      <div class="settings-content">
        <div class="settings-section">
          <h3 class="settings-section-title">Участник</h3>
          <div class="settings-item">
            <label class="settings-label">Ваше имя</label>
            <div class="settings-input-group">
              <input
                v-model="settingsParticipantName"
                type="text"
                class="settings-input"
                placeholder="Введите ваше имя"
              />
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Безопасность</h3>
          <div class="settings-item">
            <div class="settings-checkbox-group">
              <label class="settings-checkbox-label">
                <input
                  type="checkbox"
                  class="settings-checkbox checkbox-pixel"
                  :checked="e2eeState.isActive"
                  disabled
                />
                <span>End-to-End Encryption (E2EE)</span>
                <span
                  class="settings-status"
                  :class="{ active: e2eeState.isActive }"
                >
                  {{ e2eeState.isActive ? "Включено" : "Выключено" }}
                </span>
              </label>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Комната</h3>
          <div class="settings-item">
            <label class="settings-label">Код комнаты</label>
            <div class="settings-code">{{ room?.short_code || "—" }}</div>
          </div>
        </div>

        <AudioSettings ref="audioSettingsRef" />
      </div>

      <template #footer>
        <Button type="text" variant="default" @click="handleCancelSettings">
          Отмена
        </Button>
        <Button
          type="text"
          variant="accent"
          :class="{ 'button--has-changes': hasUnsavedSettingsChanges }"
          @click="handleSaveSettings"
        >
          <PixelIcon
            v-if="hasUnsavedSettingsChanges"
            name="document"
            variant="small"
          />
          Сохранить
        </Button>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useMediaControl } from "@features/media-control";
import { useE2EE, E2EEIndicator } from "@features/e2ee";
import { useConnectionIndicator } from "@features/room-connection";
import {
  useParticipantReplica,
  ReplicaInput,
} from "@features/participant-replica";
import { Button, Modal, AudioSettings, PixelIcon } from "@shared/ui";
import { VideoParticipant } from "@widgets/video-participant";
import { CollaborativeDocument } from "@widgets/collaborative-document";
import { setParticipantName, getStoredAudioInputDevice } from "@shared/lib";
import type { ComponentPublicInstance } from "vue";
import type { Room as RoomEntity } from "@entities/room";
import { RoomEvent } from "livekit-client";
import type {
  Room as LiveKitRoom,
  RemoteParticipant,
  LocalParticipant,
} from "livekit-client";

const props = defineProps<{
  room: RoomEntity | null;
  livekitRoom: LiveKitRoom | null;
  localParticipant?: LocalParticipant | null;
  remoteParticipants?: RemoteParticipant[];
  getDisplayName?: (p: RemoteParticipant | LocalParticipant) => string;
  participantName: string;
  apiBaseURL: string;
  showDocument?: boolean;
  previewMode?: boolean;
}>();

const emit = defineEmits<{
  disconnect: [];
  "update:participantName": [name: string];
}>();

const { state: e2eeState } = useE2EE(() => props.livekitRoom);

const livekitRoomRef = computed(() => props.livekitRoom);
const { connectionStatus, connectionLabel } =
  useConnectionIndicator(livekitRoomRef);

const { replicaByParticipant, sendReplica } = useParticipantReplica(
  computed(() => props.livekitRoom)
);

const isDocumentOpen = ref(false);
function toggleDocument() {
  isDocumentOpen.value = !isDocumentOpen.value;
}

const localParticipant = computed<LocalParticipant | null>(() => {
  return props.localParticipant ?? props.livekitRoom?.localParticipant ?? null;
});

const remoteParticipants = computed<RemoteParticipant[]>(() => {
  // Приоритет: используем props.remoteParticipants из useRoomConnection (уже реактивный через participantsVersion)
  if (props.remoteParticipants) {
    // Создаем новый массив для принудительной реактивности при изменении имен
    const result = props.remoteParticipants.map((p) => {
      // Принудительно читаем имя для реактивности
      const name = p.name;
      void name;
      return p;
    });
    return result;
  }
  if (!props.livekitRoom) return [];
  // Fallback: используем напрямую из livekitRoom
  return Array.from(props.livekitRoom.remoteParticipants.values());
});

// Круглый стол: все участники в одной сетке без лидера
// Используем computed с зависимостью от имен участников для реактивности
const participantsKey = ref(0); // Принудительный ключ для пересоздания компонентов
const roundTableParticipants = computed(() => {
  // Принудительно читаем ключ для реактивности
  void participantsKey.value;

  const list: (LocalParticipant | RemoteParticipant)[] = [];
  if (localParticipant.value) list.push(localParticipant.value);

  // Создаем новый массив с именами для реактивности
  const remotes = remoteParticipants.value.map((p) => {
    // Принудительно читаем имя для реактивности
    const name = p.name;
    void name;
    return p;
  });

  return [...list, ...remotes];
});

// Voice Activity Detection (VAD) from LiveKit: server detects who is speaking and sends
// updates via RoomEvent.ActiveSpeakersChanged; we map identities for the speaking border.
const speakingIdentitySet = ref<Set<string>>(new Set());
watch(
  () => props.livekitRoom,
  (room) => {
    speakingIdentitySet.value = new Set();
    if (!room) return;
    const handler = (speakers: Array<{ identity: string }>) => {
      speakingIdentitySet.value = new Set(speakers.map((s) => s.identity));
    };
    room.on(RoomEvent.ActiveSpeakersChanged, handler);
    return () => {
      room.off(RoomEvent.ActiveSpeakersChanged, handler);
    };
  },
  { immediate: true }
);

// Обработка изменения метаданных участников (включая имя)
watch(
  () => props.livekitRoom,
  (room) => {
    if (!room) return;

    const handleMetadataChanged = (
      _metadata: string | undefined,
      _participant: RemoteParticipant | LocalParticipant
    ) => {
      participantsKey.value++;
    };

    room.on(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);

    return () => {
      room.off(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);
    };
  },
  { immediate: true }
);

const isLocal = (p: LocalParticipant | RemoteParticipant) =>
  localParticipant.value?.identity === p.identity;

const fullscreenIdentity = ref<string | null>(null);

const fullscreenParticipant = computed(() => {
  const id = fullscreenIdentity.value;
  if (!id) return null;
  return roundTableParticipants.value.find((p) => p.identity === id) ?? null;
});

function handleFullSize(identity: string) {
  fullscreenIdentity.value = identity;
}

function closeFullscreen() {
  fullscreenIdentity.value = null;
}

const {
  state: mediaState,
  toggleVideo,
  toggleAudio,
  toggleScreenShare,
  switchAudioInputDevice,
} = useMediaControl(
  localParticipant,
  computed(() => props.livekitRoom)
);

const handleDisconnect = () => {
  emit("disconnect");
};

const isSettingsOpen = ref(false);
const audioSettingsRef = ref<ComponentPublicInstance | null>(null);
const initialParticipantName = ref(props.participantName);
const settingsParticipantName = ref(props.participantName);

const hasUnsavedSettingsChanges = computed(() => {
  // Проверяем изменения имени
  const nameChanged =
    settingsParticipantName.value.trim() !==
    initialParticipantName.value.trim();

  // Проверяем изменения аудио настроек
  let audioChanged = false;
  if (
    audioSettingsRef.value &&
    typeof (audioSettingsRef.value as any).hasUnsavedChanges === "function"
  ) {
    audioChanged = (audioSettingsRef.value as any).hasUnsavedChanges();
  }

  return nameChanged || audioChanged;
});

watch(
  () => props.participantName,
  (name) => {
    if (name) {
      settingsParticipantName.value = name;
      initialParticipantName.value = name;
    }
  },
  { immediate: true }
);

function handleSettings() {
  // Сбрасываем к сохраненным значениям при открытии
  settingsParticipantName.value = initialParticipantName.value;
  if (
    audioSettingsRef.value &&
    typeof (audioSettingsRef.value as any).resetSettings === "function"
  ) {
    (audioSettingsRef.value as any).resetSettings();
  }
  isSettingsOpen.value = true;
}

async function handleSaveSettings() {
  try {
    // Сохраняем имя участника
    if (settingsParticipantName.value.trim()) {
      const newName = settingsParticipantName.value.trim();
      setParticipantName(newName);
      initialParticipantName.value = newName;

      // Обновляем имя в родительском компоненте
      emit("update:participantName", newName);

      // Обновляем имя в LiveKit
      if (localParticipant.value) {
        try {
          await localParticipant.value.setName(newName);
        } catch (error) {
          console.error("❌ Ошибка при обновлении имени в LiveKit:", error);
          // Показываем пользователю предупреждение
          alert(
            "Не удалось обновить имя для других участников. " +
              "Возможно, требуется разрешение CanUpdateOwnMetadata в токене."
          );
        }
      }
    }

    // Получаем настройки аудио перед сохранением
    let audioSettingsChanged = false;
    if (
      audioSettingsRef.value &&
      typeof (audioSettingsRef.value as any).getSettings === "function"
    ) {
      const currentSettings = (audioSettingsRef.value as any).getSettings();
      const savedInput = getStoredAudioInputDevice() || "";
      audioSettingsChanged = currentSettings.inputDevice !== savedInput;
    }

    // Сохраняем настройки аудио
    if (
      audioSettingsRef.value &&
      typeof (audioSettingsRef.value as any).saveSettings === "function"
    ) {
      await (audioSettingsRef.value as any).saveSettings();
    }

    // Если микрофон активен и устройство ввода изменилось, переключаем его
    if (audioSettingsChanged && mediaState.value.isAudioEnabled) {
      try {
        await switchAudioInputDevice();
      } catch (error) {
        console.error("Failed to switch audio device:", error);
        // Можно показать уведомление пользователю, но не блокируем сохранение
      }
    }

    // Закрываем модалку
    isSettingsOpen.value = false;
  } catch (error) {
    console.error("Failed to save settings:", error);
    // Можно показать уведомление об ошибке
  }
}

function handleCancelSettings() {
  // Сбрасываем к сохраненным значениям
  settingsParticipantName.value = initialParticipantName.value;
  if (
    audioSettingsRef.value &&
    typeof (audioSettingsRef.value as any).resetSettings === "function"
  ) {
    (audioSettingsRef.value as any).resetSettings();
  }
  isSettingsOpen.value = false;
}

function handleModalClose() {
  // Если есть несохраненные изменения, спрашиваем подтверждение
  if (hasUnsavedSettingsChanges.value) {
    if (
      confirm(
        "У вас есть несохраненные изменения. Вы уверены, что хотите закрыть?"
      )
    ) {
      handleCancelSettings();
    }
  } else {
    isSettingsOpen.value = false;
  }
}
</script>

<style scoped>
.room-info h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 400;
  letter-spacing: 0.02em;
}

.connection-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.85rem;
}
.connection-indicator--warning {
  background: rgba(255, 190, 83, 0.2);
  color: var(--color-accent, #ffbe53);
}
.connection-indicator--bad {
  background: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
}
.connection-indicator__label {
  white-space: nowrap;
}

.round-table-content {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  gap: 0px;
}

.round-table-document {
  flex: 0 0 400px;
  min-height: 400px;
  max-height: 600px;
  padding: 20px;
  margin-bottom: 50px;
}

@media (min-width: 768px) {
  .round-table-document {
    width: 400px;
    margin-bottom: 0px;
    max-height: calc(100% - 90px);
  }
  .round-table-content {
    flex-direction: row;
  }
}

.round-table-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.round-table-fullscreen__video {
  width: 100%;
  height: 100%;
}

.round-table-fullscreen__video :deep(.player) {
  width: 100%;
  height: 100%;
}

.round-table-fullscreen__close {
  position: absolute;
  top: 20px;
  right: 20px;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-section-title {
  margin: 0;
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.2rem;
  font-weight: 400;
  color: #bab1a8;
  letter-spacing: 0.02em;
  border-bottom: 2px solid #333;
  padding-bottom: 8px;
}

.settings-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-label {
  font-size: 14px;
  font-weight: 500;
  color: #ccc;
}

.settings-input-group {
  display: flex;
  gap: 8px;
}

.settings-input {
  flex: 1;
  padding: 12px;
  border: 2px solid #444;
  background: #1a1a1a;
  color: white;
  font-size: 16px;
  outline: none;
  transition: none;
  font-family: inherit;
}

.settings-input:focus {
  border-color: #2980b9;
  box-shadow: inset 0 0 0 2px #2980b9;
}

.settings-code {
  padding: 12px;
  background: #2a2a2a;
  border: 2px solid #444;
  color: #bab1a8;
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.2rem;
  letter-spacing: 0.1em;
  text-align: center;
}

.settings-checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-checkbox-label {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #ccc;
  cursor: pointer;
}

.settings-checkbox {
  /* размер и вид задаёт .checkbox-pixel в design.css */
}

.settings-checkbox-label span:not(.settings-status) {
  flex: 1;
}

.settings-status {
  font-size: 12px;
  padding: 4px 8px;
  background: #333;
  border: 2px solid #444;
  color: #999;
}

.settings-status.active {
  background: #0ead61;
  color: #fff;
  border-color: #0ead61;
}

.button--has-changes {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}
</style>
