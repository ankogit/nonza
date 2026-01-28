<template>
  <div class="conference-hall dashboard bg-dark">
    <div class="room-header bg-dark-20">
      <div class="room-info color-white font-bebas">
        <h2>Room #{{ room?.short_code ?? room?.id ?? room?.name ?? "—" }}</h2>
      </div>
      <div class="room-indicators">
        <div
          v-if="!previewMode"
          class="indicator"
          :class="{ success: e2eeState.isActive, default: !e2eeState.isActive }"
          :title="e2eeState.isActive ? 'E2EE включено' : 'E2EE выключено'"
        />
      </div>
    </div>

    <div class="conference-hall__content">
      <div class="conference-hall__main">
        <div v-if="leaderParticipant" class="conference-hall__leader">
            <VideoParticipant
            :participant="leaderParticipant"
            :participant-name="
              isLocal(leaderParticipant)
                ? props.participantName
                : (props.getDisplayName?.(leaderParticipant) ?? leaderParticipant.name ?? leaderParticipant.identity)
            "
            :is-speaking="
              leaderParticipant
                ? speakingIdentitySet.has(leaderParticipant.identity)
                : false
            "
            :is-leader="true"
            :show-full-size="true"
            @full-size="
              () =>
                leaderParticipant && handleFullSize(leaderParticipant.identity)
            "
          />
          <div class="conference-hall__leader-label">👑 Main Speaker</div>
        </div>
        <div v-else class="conference-hall__placeholder">
          <span class="conference-hall__placeholder-text"
            >Waiting for speaker...</span
          >
        </div>
      </div>

      <aside class="conference-hall__sidebar">
        <section
          v-if="
            !previewMode &&
            conferenceHall.isLeader.value &&
            conferenceHall.participantsWithRaisedHands.value.length > 0
          "
          class="conference-hall__raised"
        >
          <h3 class="conference-hall__sidebar-title">✋ Поднятые руки</h3>
          <div
            v-for="participant in conferenceHall.participantsWithRaisedHands
              .value"
            :key="participant.identity"
            class="conference-hall__raised-item"
          >
            <span class="conference-hall__participant-name">{{
              getParticipantState(participant.identity)?.name ?? participant.name ?? participant.identity
            }}</span>
            <div class="conference-hall__raised-actions">
              <button
                type="button"
                class="indicator indicator--trigger success"
                title="Разрешить говорить"
                @click="handleGrantSpeaking(participant.identity)"
              >
                ✅
              </button>
              <button
                type="button"
                class="indicator indicator--trigger default"
                title="Передать лидерство"
                @click="handleTransferLeadership(participant.identity)"
              >
                👑
              </button>
            </div>
          </div>
        </section>

        <section class="conference-hall__others">
          <h3 class="conference-hall__sidebar-title">Участники</h3>
          <div class="conference-hall__others-grid">
            <Player
              v-for="p in otherParticipants"
              :key="p.identity"
              mode="list"
              :participant-name="
                isLocal(p) ? props.participantName : (props.getDisplayName?.(p) ?? p.name ?? p.identity)
              "
              :is-speaking="speakingIdentitySet.has(p.identity)"
              :is-leader="getParticipantState(p.identity)?.isLeader ?? false"
              :has-raised-hand="getParticipantState(p.identity)?.hasRaisedHand ?? false"
              :has-speaking-permission="
                getParticipantState(p.identity)?.hasSpeakingPermission ?? false
              "
            >
              <template #actions>
                <button
                  v-if="
                    !previewMode &&
                    conferenceHall.isLeader.value &&
                    getParticipantState(p.identity)?.hasRaisedHand &&
                    !getParticipantState(p.identity)?.isLeader
                  "
                  type="button"
                  class="indicator indicator--trigger success"
                  title="Разрешить говорить"
                  @click="handleGrantSpeaking(p.identity)"
                >
                  ✅
                </button>
                <button
                  v-if="
                    !previewMode &&
                    conferenceHall.isLeader.value &&
                    getParticipantState(p.identity)?.hasSpeakingPermission &&
                    !getParticipantState(p.identity)?.isLeader
                  "
                  type="button"
                  class="indicator indicator--trigger danger"
                  title="Забрать право говорить"
                  @click="handleRevokeSpeaking(p.identity)"
                >
                  🔇
                </button>
              </template>
            </Player>
            <template v-if="previewMode && otherParticipants.length === 0">
              <Player mode="list" participant-name="Alice" />
              <Player mode="list" participant-name="Bob" />
            </template>
          </div>
        </section>
      </aside>
    </div>

    <div class="menu bg-dark-20">
      <div class="left">
        <Button
          v-if="!previewMode && !conferenceHall.isLeader.value"
          :class="{ warning: hasRaisedHand }"
          :title="hasRaisedHand ? 'Опустить руку' : 'Поднять руку'"
          @click="handleRaiseHand"
        >
          ✋
        </Button>
        <Button
          :class="{
            active: mediaState.isAudioEnabled,
            danger: !mediaState.isAudioEnabled,
          }"
          :title="
            mediaState.isAudioEnabled
              ? 'Выключить микрофон'
              : 'Включить микрофон'
          "
          @click="toggleAudio"
        >
          {{ mediaState.isAudioEnabled ? "🎤" : "🔇" }}
        </Button>
        <Button
          v-if="!previewMode && conferenceHall.isLeader.value"
          :class="{
            active: mediaState.isVideoEnabled,
            danger: !mediaState.isVideoEnabled,
          }"
          :title="
            mediaState.isVideoEnabled ? 'Выключить видео' : 'Включить видео'
          "
          @click="toggleVideo"
        >
          {{ mediaState.isVideoEnabled ? "📹" : "📹" }}
        </Button>
        <Button
          v-if="!previewMode && conferenceHall.isLeader.value"
          :class="{
            active: mediaState.isScreenSharing,
            danger: !mediaState.isScreenSharing,
          }"
          title="Трансляция экрана"
          @click="toggleScreenShare"
        >
          🖥️
        </Button>
      </div>
      <div class="center">
        <Button
          variant="danger"
          title="Закончить разговор"
          @click="handleDisconnect"
        >
          📞
        </Button>
      </div>
      <div class="right">
        <Button
          variant="default"
          title="Настройки"
          @click="handleSettings"
        >
          ⚙️
        </Button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="fullscreenParticipant"
        class="conference-hall-fullscreen"
        role="dialog"
        aria-label="Во весь экран"
        @click.self="closeFullscreen"
      >
        <div class="conference-hall-fullscreen__video">
          <VideoParticipant
            :participant="fullscreenParticipant"
            :participant-name="
              isLocal(fullscreenParticipant)
                ? props.participantName
                : (props.getDisplayName?.(fullscreenParticipant) ?? fullscreenParticipant.name ?? fullscreenParticipant.identity)
            "
            :is-speaking="
              speakingIdentitySet.has(fullscreenParticipant.identity)
            "
            :is-leader="
              conferenceHall.leader.value?.identity ===
              fullscreenParticipant.identity
            "
          />
        </div>
        <Button
          class="conference-hall-fullscreen__close"
          title="Закрыть"
          aria-label="Закрыть"
          @click="closeFullscreen"
        >
          ✕
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
                  class="settings-checkbox"
                  :checked="e2eeState.isActive"
                  disabled
                />
                <span>End-to-End Encryption (E2EE)</span>
                <span class="settings-status" :class="{ active: e2eeState.isActive }">
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
          {{ hasUnsavedSettingsChanges ? "💾 Сохранить" : "Сохранить" }}
        </Button>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useMediaControl } from "@features/media-control";
import { useConferenceHall } from "@features/conference-hall";
import { useE2EE } from "@features/e2ee";
import { Button, Modal, AudioSettings } from "@shared/ui";
import { VideoParticipant, Player } from "@widgets/video-participant";
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

const { state: e2eeState } = useE2EE(props.livekitRoom);

const localParticipant = computed<LocalParticipant | null>(() => {
  return props.localParticipant ?? props.livekitRoom?.localParticipant ?? null;
});

const remoteParticipants = computed<RemoteParticipant[]>(() => {
  // Приоритет: используем props.remoteParticipants из useRoomConnection (уже реактивный)
  if (props.remoteParticipants) {
    // Создаем новый массив для принудительной реактивности при изменении имен
    return props.remoteParticipants.map((p) => {
      // Принудительно читаем имя для реактивности
      const name = p.name;
      void name;
      return p;
    });
  }
  if (!props.livekitRoom) return [];
  // Fallback: используем напрямую из livekitRoom
  return Array.from(props.livekitRoom.remoteParticipants.values());
});

watch(
  () => props.remoteParticipants,
  () => remoteParticipants.value,
  { deep: true, immediate: true },
);

const conferenceHall = useConferenceHall(
  () => localParticipant.value,
  () => remoteParticipants.value,
  () => props.participantName,
  () => props.livekitRoom,
);

watch(
  [localParticipant, remoteParticipants, () => props.participantName],
  () => {
    conferenceHall.updateParticipants();
  },
  {
    deep: true,
    immediate: true,
  },
);

// Слушаем изменения метаданных участников (включая имя)
watch(
  () => props.livekitRoom,
  (room) => {
    if (!room) return;
    
    const handleMetadataChanged = (_metadata: string | undefined, participant: RemoteParticipant | LocalParticipant) => {
      console.log("Metadata changed for participant:", participant.identity, "new name:", participant.name);
      conferenceHall.updateParticipants();
    };
    
    room.on(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);
    
    return () => {
      room.off(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);
    };
  },
  { immediate: true },
);

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
  { immediate: true },
);

// Обработка изменения метаданных участников (включая имя)
watch(
  () => props.livekitRoom,
  (room) => {
    if (!room) return;
    
    const handleMetadataChanged = (_metadata: string | undefined, participant: RemoteParticipant | LocalParticipant) => {
      console.log(
        "ConferenceHall: Participant metadata changed:",
        participant.identity,
        "new name:",
        participant.name,
        "isLocal:",
        participant === room.localParticipant,
      );
      // Обновляем состояние conferenceHall
      conferenceHall.updateParticipants();
      console.log(
        "After update, participant name in conferenceHall:",
        conferenceHall.state.value.participants.get(participant.identity)?.name,
      );
    };
    
    room.on(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);
    
    return () => {
      room.off(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);
    };
  },
  { immediate: true },
);

const leaderParticipant = computed(() => {
  if (!conferenceHall.leader.value) return null;
  const id = conferenceHall.leader.value.identity;
  if (localParticipant.value?.identity === id) return localParticipant.value;
  return remoteParticipants.value.find((p) => p.identity === id) || null;
});

const otherParticipants = computed(() => {
  const leaderId = conferenceHall.leader.value?.identity;
  if (!leaderId) {
    const all: (LocalParticipant | RemoteParticipant)[] = [];
    if (localParticipant.value) all.push(localParticipant.value);
    return [...all, ...remoteParticipants.value];
  }
  const others: (LocalParticipant | RemoteParticipant)[] = [];
  if (localParticipant.value && localParticipant.value.identity !== leaderId) {
    others.push(localParticipant.value);
  }
  return [
    ...others,
    ...remoteParticipants.value.filter((p) => p.identity !== leaderId),
  ];
});

const isLocal = (p: LocalParticipant | RemoteParticipant) =>
  localParticipant.value?.identity === p.identity;

const fullscreenIdentity = ref<string | null>(null);

const fullscreenParticipant = computed(() => {
  const id = fullscreenIdentity.value;
  if (!id) return null;
  const leader = leaderParticipant.value;
  if (leader?.identity === id) return leader;
  return otherParticipants.value.find((p) => p.identity === id) ?? null;
});

function handleFullSize(identity: string) {
  fullscreenIdentity.value = identity;
}

function closeFullscreen() {
  fullscreenIdentity.value = null;
}

const getParticipantState = (identity: string) =>
  conferenceHall.state.value.participants.get(identity);

const hasRaisedHand = computed(() => {
  if (!localParticipant.value) return false;
  return (
    getParticipantState(localParticipant.value.identity)?.hasRaisedHand ?? false
  );
});

const {
  state: mediaState,
  toggleVideo,
  toggleAudio,
  toggleScreenShare,
  switchAudioInputDevice,
} = useMediaControl(localParticipant);

const handleRaiseHand = () => {
  hasRaisedHand.value ? conferenceHall.lowerHand() : conferenceHall.raiseHand();
};

const handleGrantSpeaking = (participantIdentity: string) => {
  conferenceHall.grantSpeakingPermission(participantIdentity);
};

const handleRevokeSpeaking = (participantIdentity: string) => {
  conferenceHall.revokeSpeakingPermission(participantIdentity);
};

const handleTransferLeadership = (participantIdentity: string) => {
  if (confirm("Передать лидерство этому участнику?")) {
    conferenceHall.transferLeadership(participantIdentity);
  }
};

const handleDisconnect = () => emit("disconnect");

const isSettingsOpen = ref(false);
const audioSettingsRef = ref<ComponentPublicInstance | null>(null);
const initialParticipantName = ref(props.participantName);
const settingsParticipantName = ref(props.participantName);

const hasUnsavedSettingsChanges = computed(() => {
  // Проверяем изменения имени
  const nameChanged = settingsParticipantName.value.trim() !== initialParticipantName.value.trim();
  
  // Проверяем изменения аудио настроек
  let audioChanged = false;
  if (audioSettingsRef.value && typeof (audioSettingsRef.value as any).hasUnsavedChanges === "function") {
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
  { immediate: true },
);

function handleSettings() {
  // Сбрасываем к сохраненным значениям при открытии
  settingsParticipantName.value = initialParticipantName.value;
  if (audioSettingsRef.value && typeof (audioSettingsRef.value as any).resetSettings === "function") {
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
          console.log("✅ Имя успешно обновлено в LiveKit:", newName);
          console.log("Текущее имя в localParticipant:", localParticipant.value.name);
        } catch (error) {
          console.error("❌ Ошибка при обновлении имени в LiveKit:", error);
          // Показываем пользователю предупреждение
          alert(
            "Не удалось обновить имя для других участников. " +
            "Возможно, требуется разрешение CanUpdateOwnMetadata в токене."
          );
        }
      }
      
      // Обновляем состояние в conferenceHall (имя уже обновится через событие ParticipantMetadataChanged)
      // Но обновим сразу для локального отображения
      conferenceHall.updateParticipants();
    }

    // Получаем настройки аудио перед сохранением
    let audioSettingsChanged = false;
    if (audioSettingsRef.value && typeof (audioSettingsRef.value as any).getSettings === "function") {
      const currentSettings = (audioSettingsRef.value as any).getSettings();
      const savedInput = getStoredAudioInputDevice() || "";
      audioSettingsChanged = currentSettings.inputDevice !== savedInput;
    }

    // Сохраняем настройки аудио
    if (audioSettingsRef.value && typeof (audioSettingsRef.value as any).saveSettings === "function") {
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
  if (audioSettingsRef.value && typeof (audioSettingsRef.value as any).resetSettings === "function") {
    (audioSettingsRef.value as any).resetSettings();
  }
  isSettingsOpen.value = false;
}

function handleModalClose() {
  // Если есть несохраненные изменения, спрашиваем подтверждение
  if (hasUnsavedSettingsChanges.value) {
    if (confirm("У вас есть несохраненные изменения. Вы уверены, что хотите закрыть?")) {
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

.conference-hall__content {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow: hidden;
  min-height: 0;
}

.conference-hall__main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.conference-hall__leader {
  width: 100%;
  max-width: 800px;
  position: relative;
  aspect-ratio: 16/9;
}

.conference-hall__leader :deep(.player) {
  width: 100%;
  height: 100%;
}

.conference-hall__leader-label {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 6px 12px;
  background: var(--color-surface, #2a2a2a);
  font-size: 14px;
  font-weight: 600;
  z-index: 2;
}

.conference-hall__placeholder {
  width: 100%;
  max-width: 800px;
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #00000020;
  border: 2px solid #333;
}

.conference-hall__placeholder-text {
  color: #888;
  font-size: 1.125rem;
}

.conference-hall__sidebar {
  width: 340px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.conference-hall__sidebar-title {
  margin: 0 0 8px 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: #bab1a8;
}

.conference-hall__raised {
  padding: 12px;
  background: #00000020;
  border: 2px solid #333;
}

.conference-hall__raised-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  gap: 8px;
  border-bottom: 1px solid #333;
}

.conference-hall__raised-item:last-child {
  border-bottom: none;
}

.conference-hall__participant-name {
  flex: 1;
  font-size: 14px;
  min-width: 0;
}

.conference-hall__raised-actions {
  display: flex;
  gap: 4px;
}

.conference-hall__others {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.conference-hall__others-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.button--small {
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  font-size: 0.875rem;
}

.conference-hall-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.conference-hall-fullscreen__video {
  width: 100%;
  height: 100%;
}

.conference-hall-fullscreen__video :deep(.player) {
  width: 100%;
  height: 100%;
}

.conference-hall-fullscreen__close {
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
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: #2980b9;
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
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}
</style>
