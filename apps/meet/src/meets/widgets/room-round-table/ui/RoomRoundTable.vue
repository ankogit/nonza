<template>
  <div class="dashboard bg-dark">
    <header
      v-if="settingsInUpperMenu"
      class="round-table__top-menu room-header bg-dark-20"
    >
      <div class="room-info color-white font-bebas">
        <h2 class="room-info-title">{{ room?.name ?? 'Созвон' }}</h2>
      </div>
      <div class="room-indicators">
        <Button
          variant="default"
          size="small"
          title="Настройки"
          @click="handleSettings"
        >
          <PixelIcon name="settings" variant="small" />
        </Button>
      </div>
    </header>
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
              : (props.getDisplayName?.(p) ?? p.name ?? p.identity)
          "
          :participant-color="participantColorFor(p)"
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
          :participant-color="participantColorForDocument"
        />
      </div>
    </div>

    <CallMenu @disconnect="handleDisconnect">
      <template #left>
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
      </template>
      <template #right>
        <Button
          v-if="settingsInCallMenu"
          variant="default"
          size="small"
          title="Настройки"
          @click="handleSettings"
        >
          <PixelIcon name="settings" variant="large" />
        </Button>
        <Button
          v-if="props.showDocument"
          variant="default"
          :class="{ active: isDocumentOpen }"
          :title="isDocumentOpen ? 'Скрыть документ' : 'Совместный документ'"
          @click="toggleDocument"
        >
          <PixelIcon name="document" variant="large" />
        </Button>
      </template>
    </CallMenu>

    <Teleport to="body">
      <div
        v-if="fullscreenParticipant"
        class="room-fullscreen grain-overlay"
        role="dialog"
        aria-label="Во весь экран"
        @click.self="closeFullscreen"
      >
        <Button
          variant="default"
          size="small"
          class="room-fullscreen__close"
          title="Закрыть полноэкранный режим"
          aria-label="Закрыть"
          @click="closeFullscreen"
        >
          <PixelIcon name="close" variant="large" />
        </Button>
        <div class="room-fullscreen__video">
          <VideoParticipant
            :participant="fullscreenParticipant"
            :participant-name="
              isLocal(fullscreenParticipant)
                ? props.participantName
                : (props.getDisplayName?.(fullscreenParticipant) ??
                  fullscreenParticipant.name ??
                  fullscreenParticipant.identity)
            "
            :participant-color="participantColorFor(fullscreenParticipant)"
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
            :preferred-video-source="
              showFullscreenCameraPiP ? 'screen-share' : undefined
            "
            :on-tracks-updated="() => fullscreenTracksVersion++"
          />
        </div>
        <div
          v-if="
            showFullscreenSelfPiP &&
            fullscreenSelfPiPVisible &&
            localParticipant
          "
          class="room-fullscreen__pip"
          :style="fullscreenSelfPiPStyle"
          @pointerdown="fullscreenSelfPiPDraggable.handlePointerDown"
        >
          <Player
            mode="grid"
            :participant="localParticipant"
            :participant-name="props.participantName"
            :participant-color="
              localParticipant ? participantColorFor(localParticipant) : undefined
            "
            :is-speaking="
              fullscreenParticipant
                ? speakingIdentitySet.has(localParticipant.identity)
                : false
            "
            :show-full-size="false"
            :pip="false"
            :replica-text="
              replicaByParticipant[localParticipant?.identity]?.text
            "
          />
          <div
            data-pip-resize-handle
            class="room-fullscreen__pip-resize"
            title="Изменить размер"
            @pointerdown.stop="
              fullscreenSelfPiPDraggable.handleResizePointerDown
            "
          />
          <Button
            class="room-fullscreen__pip-close"
            variant="default"
            size="small"
            icon-size="28px"
            aria-label="Скрыть"
            title="Скрыть миниатюру"
            @click.stop="toggleFullscreenSelfPiPVisible"
          >
            <PixelIcon name="close" variant="small" />
          </Button>
        </div>
        <div
          v-if="showFullscreenCameraPiP && fullscreenParticipant"
          class="room-fullscreen__pip"
          :style="fullscreenCameraPiPStyle"
          @pointerdown="fullscreenCameraPiPDraggable.handlePointerDown"
        >
          <VideoParticipant
            :participant="fullscreenParticipant"
            :participant-name="
              isLocal(fullscreenParticipant)
                ? props.participantName
                : (props.getDisplayName?.(fullscreenParticipant) ??
                  fullscreenParticipant.name ??
                  fullscreenParticipant.identity)
            "
            :participant-color="participantColorFor(fullscreenParticipant)"
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
            preferred-video-source="camera"
          />
          <div
            data-pip-resize-handle
            class="room-fullscreen__pip-resize"
            title="Изменить размер"
            @pointerdown.stop="
              fullscreenCameraPiPDraggable.handleResizePointerDown
            "
          />
        </div>
        <Button
          v-if="false && showFullscreenSelfPiP && !fullscreenSelfPiPVisible"
          variant="default"
          size="small"
          class="room-fullscreen__show-pip"
          title="Показать свою миниатюру"
          @click="toggleFullscreenSelfPiPVisible"
        >
          <PixelIcon name="video-on" variant="small" />
          <span>Показать себя</span>
        </Button>
        <div ref="fullscreenMenuRef" class="room-fullscreen__menu-wrapper">
          <CallMenu
            menu-class="room-fullscreen__menu"
            @disconnect="handleDisconnect"
          >
            <template #left>
              <Button
                :class="{
                  active: mediaState.isAudioEnabled,
                  default: !mediaState.isAudioEnabled,
                }"
                :title="
                  mediaState.isAudioEnabled
                    ? 'Выключить микрофон (M)'
                    : 'Включить микрофон (M)'
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
                  mediaState.isVideoEnabled
                    ? 'Выключить видео'
                    : 'Включить видео'
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
            </template>
            <template #right>
              <Button
                v-if="props.showDocument"
                variant="default"
                :class="{ active: isDocumentOpen }"
                :title="
                  isDocumentOpen ? 'Скрыть документ' : 'Совместный документ'
                "
                @click="toggleDocument"
              >
                <PixelIcon name="document" variant="large" />
              </Button>
            </template>
          </CallMenu>
        </div>
      </div>
    </Teleport>

    <Modal
      v-model="isSettingsOpen"
      title="Настройки"
      :close-on-overlay-click="!hasUnsavedSettingsChanges"
      @close="handleModalClose"
    >
      <div class="settings-content">
        <div v-if="isAnonymousForSettings" class="settings-section">
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

        <div v-if="room?.allow_anonymous_join" class="settings-section">
          <h3 class="settings-section-title">Комната</h3>
          <div class="settings-item">
            <label class="settings-label">Код комнаты</label>
            <div class="settings-code">{{ room?.short_code || "—" }}</div>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Видео</h3>
          <div class="settings-item">
            <label class="settings-label">Качество по умолчанию</label>
            <PixelSelect
              v-model="settingsDefaultVideoQuality"
              :options="[
                { value: '360p', label: '360p (экономный трафик)' },
                { value: '720p', label: '720p' },
                { value: '1080p', label: '1080p (максимум)' },
              ]"
              class="settings-quality-select"
              aria-label="Качество видео"
            />
          </div>
        </div>
        <AudioSettings ref="audioSettingsRef" />
        <div class="settings-section">
          <h3 class="settings-section-title">Звуковые уведомления</h3>
          <div class="settings-item">
            <Switch
              v-model="replicaTtsEnabled"
              aria-label="Озвучивать реплики (TTS)"
            >
              <span>Озвучивать реплики (TTS)</span>
            </Switch>
          </div>
        </div>
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
import { ref, computed, watch, nextTick } from "vue";
import { useMediaControl } from "@features/media-control";
import { useE2EE } from "@features/e2ee";
import { useConnectionIndicator } from "@features/room-connection";
import {
  useParticipantReplica,
  ReplicaInput,
} from "@features/participant-replica";
import {
  Button,
  Modal,
  AudioSettings,
  PixelIcon,
  PixelSelect,
  Switch,
} from "@shared/ui";
import { VideoParticipant, Player } from "@widgets/video-participant";
import { CallMenu } from "@widgets/call-menu";
import { CollaborativeDocument } from "@widgets/collaborative-document";
import {
  setParticipantName,
  getStoredAudioInputDevice,
  getStoredVideoInputDevice,
  getStoredMediaState,
  setStoredMediaState,
  useDraggablePiP,
  useMeetingHotkeys,
  useTauriGlobalShortcuts,
  getReplicaTtsEnabled,
  setReplicaTtsEnabled,
  speakReplicaTextWithVoice,
  getAuthState,
  DEFAULT_PARTICIPANT_COLOR,
  parseParticipantColorFromMetadata,
  getStoredDefaultVideoQuality,
  setStoredDefaultVideoQuality,
  type VideoQualityLevel,
} from "@shared/lib";
import type { ComponentPublicInstance } from "vue";
import type { Room as RoomEntity } from "@shared/entities";
import { RoomEvent, Track } from "livekit-client";
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
  settingsInCallMenu?: boolean;
  settingsInUpperMenu?: boolean;
  updateParticipantName?: (name: string) => void;
}>();

const emit = defineEmits<{
  disconnect: [];
  "update:participantName": [name: string];
}>();

const participantColorForDocument = computed(() => {
  const c = getAuthState()?.user?.color;
  if (c && c.trim() !== "") return c;
  return DEFAULT_PARTICIPANT_COLOR;
});

function participantColorFor(p: LocalParticipant | RemoteParticipant): string {
  const name =
    p.identity === localParticipant.value?.identity
      ? props.participantName
      : (props.getDisplayName?.(p) ?? (p as RemoteParticipant).name ?? p.identity);
  return parseParticipantColorFromMetadata(
    (p as { metadata?: string }).metadata,
    name,
  );
}

defineExpose({
  openCallSettings: handleSettings,
});

const { state: e2eeState } = useE2EE(() => props.livekitRoom);

const livekitRoomRef = computed(() => props.livekitRoom);
useConnectionIndicator(livekitRoomRef);

const replicaTtsEnabled = ref(getReplicaTtsEnabled());
const initialReplicaTtsEnabled = ref(replicaTtsEnabled.value);

const { replicaByParticipant, sendReplica } = useParticipantReplica(
  computed(() => props.livekitRoom),
  {
    speakReplica: (text, meta) => {
      if (replicaTtsEnabled.value) {
        speakReplicaTextWithVoice(text, meta);
      }
    },
  },
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
  { immediate: true },
);

// Обработка изменения метаданных участников (включая имя)
watch(
  () => props.livekitRoom,
  (room) => {
    if (!room) return;

    const handleMetadataChanged = (
      _metadata: string | undefined,
      _participant: RemoteParticipant | LocalParticipant,
    ) => {
      participantsKey.value++;
    };

    room.on(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);

    return () => {
      room.off(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);
    };
  },
  { immediate: true },
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
  fullscreenSelfPiPVisible.value = true;
}

const {
  state: mediaState,
  toggleVideo,
  toggleAudio,
  toggleScreenShare,
  switchAudioInputDevice,
  switchVideoInputDevice,
} = useMediaControl(
  localParticipant,
  computed(() => props.livekitRoom),
);

const fullscreenMenuRef = ref<HTMLElement | null>(null);
const fullscreenSelfPiPVisible = ref(true);
const fullscreenSelfPiPDraggable = useDraggablePiP(undefined, undefined, {
  getBottomOffset: () => (fullscreenMenuRef.value?.offsetHeight ?? 88) + 36,
  defaultSide: "right",
});
const showFullscreenSelfPiP = computed(
  () => fullscreenParticipant.value && !isLocal(fullscreenParticipant.value!),
);
const fullscreenSelfPiPStyle = computed(() => ({
  left: fullscreenSelfPiPDraggable.position.value.x + "px",
  top: fullscreenSelfPiPDraggable.position.value.y + "px",
  width: fullscreenSelfPiPDraggable.size.value.width + "px",
  height: fullscreenSelfPiPDraggable.size.value.height + "px",
}));

function toggleFullscreenSelfPiPVisible() {
  fullscreenSelfPiPVisible.value = !fullscreenSelfPiPVisible.value;
}

function participantHasBothCameraAndScreen(
  p: LocalParticipant | RemoteParticipant | null,
): boolean {
  if (!p?.videoTrackPublications) return false;
  type VideoPub = {
    source: Track.Source;
    track?: { mediaStreamTrack: MediaStreamTrack };
    isSubscribed?: boolean;
  };
  const pubs = Array.from(
    p.videoTrackPublications.values() as unknown as Iterable<VideoPub>,
  );
  const isLocalP = localParticipant.value?.identity === p.identity;
  const has = (source: Track.Source) =>
    pubs.some(
      (pub) =>
        pub.source === source &&
        pub.track &&
        pub.track.mediaStreamTrack?.readyState !== "ended" &&
        (isLocalP || pub.isSubscribed),
    );
  return has(Track.Source.Camera) && has(Track.Source.ScreenShare);
}

const fullscreenTracksVersion = ref(0);
const fullscreenCameraPiPDraggable = useDraggablePiP(undefined, undefined, {
  getBottomOffset: () => (fullscreenMenuRef.value?.offsetHeight ?? 88) + 36,
  defaultSide: "left",
});
const fullscreenCameraPiPStyle = computed(() => ({
  left: fullscreenCameraPiPDraggable.position.value.x + "px",
  top: fullscreenCameraPiPDraggable.position.value.y + "px",
  width: fullscreenCameraPiPDraggable.size.value.width + "px",
  height: fullscreenCameraPiPDraggable.size.value.height + "px",
}));
const showFullscreenCameraPiP = computed(() => {
  fullscreenTracksVersion.value;
  const p = fullscreenParticipant.value;
  return p !== null && participantHasBothCameraAndScreen(p);
});

const handleDisconnect = () => {
  emit("disconnect");
};

useMeetingHotkeys({
  toggleAudio,
  toggleVideo,
  toggleScreenShare: props.previewMode ? undefined : toggleScreenShare,
  leaveRoom: handleDisconnect,
  enabled: () => !!props.livekitRoom,
});
useTauriGlobalShortcuts({
  toggleAudio,
  toggleVideo,
  toggleScreenShare: props.previewMode ? undefined : toggleScreenShare,
  leaveRoom: handleDisconnect,
  enabled: () => !!props.livekitRoom,
});

const initialMediaStateApplied = ref(false);
watch(
  [() => props.livekitRoom, () => props.room?.short_code],
  ([room, shortCode]) => {
    if (!room || !shortCode) {
      initialMediaStateApplied.value = false;
      return;
    }
    if (initialMediaStateApplied.value) return;
    initialMediaStateApplied.value = true;
    const stored = getStoredMediaState(shortCode);
    nextTick(() => {
      if (stored.micEnabled && !mediaState.value.isAudioEnabled) {
        toggleAudio();
      }
      if (stored.videoEnabled && !mediaState.value.isVideoEnabled) {
        toggleVideo();
      }
    });
  },
  { immediate: true },
);

watch(
  [() => mediaState.value.isAudioEnabled, () => mediaState.value.isVideoEnabled],
  () => {
    const code = props.room?.short_code;
    if (code) {
      setStoredMediaState(code, {
        micEnabled: mediaState.value.isAudioEnabled,
        videoEnabled: mediaState.value.isVideoEnabled,
      });
    }
  },
);

const isSettingsOpen = ref(false);
const audioSettingsRef = ref<ComponentPublicInstance | null>(null);
const initialParticipantName = ref(props.participantName);
const settingsParticipantName = ref(props.participantName);
const initialDefaultVideoQuality = ref<VideoQualityLevel>(
  getStoredDefaultVideoQuality(),
);
const settingsDefaultVideoQuality = ref<VideoQualityLevel>(
  getStoredDefaultVideoQuality(),
);

const isAnonymousForSettings = computed(() => !getAuthState()?.user);

const hasUnsavedSettingsChanges = computed(() => {
  const nameChanged =
    isAnonymousForSettings.value &&
    settingsParticipantName.value.trim() !==
      initialParticipantName.value.trim();

  let audioChanged = false;
  if (
    audioSettingsRef.value &&
    typeof (audioSettingsRef.value as any).hasUnsavedChanges === "function"
  ) {
    audioChanged = (audioSettingsRef.value as any).hasUnsavedChanges();
  }

  const ttsChanged =
    replicaTtsEnabled.value !== initialReplicaTtsEnabled.value;
  const videoQualityChanged =
    settingsDefaultVideoQuality.value !== initialDefaultVideoQuality.value;

  return nameChanged || audioChanged || ttsChanged || videoQualityChanged;
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
  settingsParticipantName.value = initialParticipantName.value;
  replicaTtsEnabled.value = initialReplicaTtsEnabled.value;
  settingsDefaultVideoQuality.value = initialDefaultVideoQuality.value;
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
    if (
      isAnonymousForSettings.value &&
      settingsParticipantName.value.trim()
    ) {
      const newName = settingsParticipantName.value.trim();
      setParticipantName(newName);
      initialParticipantName.value = newName;

      emit("update:participantName", newName);

      nextTick(() => {
        if (props.updateParticipantName) {
          props.updateParticipantName(newName);
        } else if (localParticipant.value) {
          try {
            localParticipant.value.setName(newName);
          } catch (err) {
            console.error("Failed to update name in LiveKit:", err);
          }
        }
      });
    }

    let audioSettingsChanged = false;
    let videoSettingsChanged = false;
    if (
      audioSettingsRef.value &&
      typeof (audioSettingsRef.value as any).getSettings === "function"
    ) {
      const currentSettings = (audioSettingsRef.value as any).getSettings();
      const savedInput = getStoredAudioInputDevice() || "";
      const savedVideo = getStoredVideoInputDevice() || "";
      audioSettingsChanged = currentSettings.inputDevice !== savedInput;
      videoSettingsChanged =
        (currentSettings.videoDevice ?? "") !== (savedVideo ?? "");
    }

    if (
      audioSettingsRef.value &&
      typeof (audioSettingsRef.value as any).saveSettings === "function"
    ) {
      await (audioSettingsRef.value as any).saveSettings();
    }

    if (audioSettingsChanged && mediaState.value.isAudioEnabled) {
      try {
        await switchAudioInputDevice();
      } catch (error) {
        console.error("Failed to switch audio device:", error);
      }
    }

    if (videoSettingsChanged && mediaState.value.isVideoEnabled) {
      try {
        await switchVideoInputDevice();
      } catch (error) {
        console.error("Failed to switch video device:", error);
      }
    }

    if (replicaTtsEnabled.value !== initialReplicaTtsEnabled.value) {
      setReplicaTtsEnabled(replicaTtsEnabled.value);
      initialReplicaTtsEnabled.value = replicaTtsEnabled.value;
    }

    if (settingsDefaultVideoQuality.value !== initialDefaultVideoQuality.value) {
      setStoredDefaultVideoQuality(settingsDefaultVideoQuality.value);
      initialDefaultVideoQuality.value = settingsDefaultVideoQuality.value;
    }

    isSettingsOpen.value = false;
  } catch (error) {
    console.error("Failed to save settings:", error);
    // Можно показать уведомление об ошибке
  }
}

function handleCancelSettings() {
  if (isAnonymousForSettings.value) {
    settingsParticipantName.value = initialParticipantName.value;
  }
  replicaTtsEnabled.value = initialReplicaTtsEnabled.value;
  settingsDefaultVideoQuality.value = initialDefaultVideoQuality.value;
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
        "У вас есть несохраненные изменения. Вы уверены, что хотите закрыть?",
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
  color: var(--color-accent, #ffc866);
}
.connection-indicator--bad {
  background: rgba(231, 76, 60, 0.2);
  color: #e2534b;
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

@media (max-width: 480px) {
  .round-table-document {
    flex: 0 0 auto;
    width: 100%;
    max-width: 100%;
    min-height: 280px;
    padding: 12px;
  }
}

</style>
