<template>
  <div class="conference-hall dashboard bg-dark">
    <header
      v-if="settingsInUpperMenu"
      class="conference-hall__top-menu room-header bg-dark-20"
    >
      <div class="room-info color-white font-bebas">
        <h2 class="room-info-title">{{ room?.name ?? "Созвон" }}</h2>
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
    <div class="conference-hall__content">
      <div class="conference-hall__main">
        <div
          v-if="conferenceHall.stateSynced && leaderParticipant"
          class="conference-hall__leader"
        >
          <VideoParticipant
            :participant="resolveParticipant(leaderParticipant)"
            :participant-name="
              isLocal(leaderParticipant)
                ? props.participantName
                : (props.getDisplayName?.(leaderParticipant) ??
                  leaderParticipant.name ??
                  leaderParticipant.identity)
            "
            :participant-color="leaderParticipantColor"
            :is-speaking="
              leaderParticipant
                ? speakingIdentitySet.has(leaderParticipant.identity)
                : false
            "
            :is-leader="true"
            :show-full-size="true"
            :replica-text="
              leaderParticipant
                ? replicaByParticipant[leaderParticipant.identity]?.text
                : undefined
            "
            @full-size="
              () =>
                leaderParticipant && handleFullSize(leaderParticipant.identity)
            "
          />
          <div class="conference-hall__leader-label">
            <PixelIcon name="leader" variant="small" /> Main Speaker
          </div>
        </div>
        <div v-else class="conference-hall__placeholder">
          <span class="conference-hall__placeholder-text font-bebas"
            >Ожидание лидера...</span
          >
        </div>
      </div>

      <template v-if="hideSidebar">
        <Teleport to="body">
          <Transition name="conference-hall-panel">
            <div
              v-if="showParticipantsPanel"
              class="conference-hall__panel-overlay"
              @click.self="showParticipantsPanel = false"
            >
              <aside
                class="conference-hall__sidebar conference-hall__sidebar--panel"
              >
                <header class="conference-hall__panel-header">
                  <h2 class="conference-hall__sidebar-title font-bebas">
                    Участники
                  </h2>
                  <Button
                    variant="default"
                    size="small"
                    title="Закрыть"
                    @click="showParticipantsPanel = false"
                  >
                    <PixelIcon name="close" variant="small" />
                  </Button>
                </header>
                <section
                  v-if="
                    !previewMode &&
                    conferenceHall.isLeader.value &&
                    conferenceHall.participantsWithRaisedHands.value.length > 0
                  "
                  class="conference-hall__raised"
                >
                  <h3 class="conference-hall__sidebar-title font-bebas">
                    <PixelIcon name="hand" variant="small" /> Поднятые руки
                  </h3>
                  <div
                    v-for="participant in conferenceHall
                      .participantsWithRaisedHands.value"
                    :key="participant.identity"
                    class="conference-hall__raised-item"
                  >
                    <span
                      class="conference-hall__participant-name font-bebas"
                      >{{
                        getParticipantState(participant.identity)?.name ??
                        participant.name ??
                        participant.identity
                      }}</span
                    >
                    <div class="conference-hall__raised-actions">
                      <Indicator
                        variant="success"
                        title="Разрешить говорить"
                        aria-label="Разрешить говорить"
                        @click="handleGrantSpeaking(participant.identity)"
                      >
                        <PixelIcon name="check" variant="small" />
                      </Indicator>
                      <Indicator
                        variant="default"
                        title="Передать лидерство"
                        aria-label="Передать лидерство"
                        @click="handleTransferLeadership(participant.identity)"
                      >
                        <PixelIcon name="leader" variant="small" />
                      </Indicator>
                    </div>
                  </div>
                </section>
                <section class="conference-hall__others">
                  <hr class="HR" />
                  <div class="conference-hall__others-grid">
                    <RoomParticipantsList
                      :key="sidebarParticipantsListKey"
                      :participants="sidebarParticipantList"
                    >
                      <template #actions="{ participant: item }">
                        <Indicator
                          v-if="
                            !previewMode &&
                            conferenceHall.isLeader.value &&
                            getParticipantState(item.identity)?.hasRaisedHand &&
                            !getParticipantState(item.identity)
                              ?.hasSpeakingPermission &&
                            !getParticipantState(item.identity)?.isLeader
                          "
                          variant="success"
                          title="Дать право голоса"
                          aria-label="Дать право голоса"
                          @click="handleGrantSpeaking(item.identity)"
                        >
                          <PixelIcon name="check" variant="small" />
                        </Indicator>
                        <Indicator
                          v-if="
                            !previewMode &&
                            conferenceHall.isLeader.value &&
                            getParticipantState(item.identity)
                              ?.hasSpeakingPermission &&
                            !getParticipantState(item.identity)?.isLeader
                          "
                          variant="success"
                          title="Забрать право голоса"
                          aria-label="Забрать право голоса"
                          @click="handleRevokeSpeaking(item.identity)"
                        >
                          <PixelIcon name="mic-on" variant="small" />
                        </Indicator>
                        <Indicator
                          v-else-if="
                            !previewMode &&
                            !conferenceHall.isLeader.value &&
                            getParticipantState(item.identity)
                              ?.hasSpeakingPermission &&
                            !getParticipantState(item.identity)?.isLeader
                          "
                          :trigger="false"
                          variant="success"
                          title="Право голоса"
                          aria-label="Право голоса"
                        >
                          <PixelIcon name="mic-on" variant="small" />
                        </Indicator>
                      </template>
                    </RoomParticipantsList>
                  </div>
                </section>
              </aside>
            </div>
          </Transition>
        </Teleport>
      </template>

      <aside v-if="!hideSidebar" class="conference-hall__sidebar">
        <section
          v-if="
            !previewMode &&
            conferenceHall.isLeader.value &&
            conferenceHall.participantsWithRaisedHands.value.length > 0
          "
          class="conference-hall__raised"
        >
          <h3 class="conference-hall__sidebar-title font-bebas">
            <PixelIcon name="hand" variant="small" /> Поднятые руки
          </h3>
          <div
            v-for="participant in conferenceHall.participantsWithRaisedHands
              .value"
            :key="participant.identity"
            class="conference-hall__raised-item"
          >
            <span class="conference-hall__participant-name font-bebas">{{
              getParticipantState(participant.identity)?.name ??
              participant.name ??
              participant.identity
            }}</span>
            <div class="conference-hall__raised-actions">
              <Indicator
                variant="success"
                title="Разрешить говорить"
                aria-label="Разрешить говорить"
                @click="handleGrantSpeaking(participant.identity)"
              >
                <PixelIcon name="check" variant="small" />
              </Indicator>
              <Indicator
                variant="default"
                title="Передать лидерство"
                aria-label="Передать лидерство"
                @click="handleTransferLeadership(participant.identity)"
              >
                <PixelIcon name="leader" variant="small" />
              </Indicator>
            </div>
          </div>
        </section>

        <section class="conference-hall__others">
          <h2 class="conference-hall__sidebar-title font-bebas">Участники</h2>
          <hr class="HR" />

          <div class="conference-hall__others-grid">
            <RoomParticipantsList
              :key="sidebarParticipantsListKey"
              :participants="sidebarParticipantList"
            >
              <template #actions="{ participant: item }">
                <Indicator
                  v-if="
                    !previewMode &&
                    conferenceHall.isLeader.value &&
                    getParticipantState(item.identity)?.hasRaisedHand &&
                    !getParticipantState(item.identity)
                      ?.hasSpeakingPermission &&
                    !getParticipantState(item.identity)?.isLeader
                  "
                  variant="success"
                  title="Дать право голоса"
                  aria-label="Дать право голоса"
                  @click="handleGrantSpeaking(item.identity)"
                >
                  <PixelIcon name="check" variant="small" />
                </Indicator>
                <Indicator
                  v-if="
                    !previewMode &&
                    conferenceHall.isLeader.value &&
                    getParticipantState(item.identity)?.hasSpeakingPermission &&
                    !getParticipantState(item.identity)?.isLeader
                  "
                  variant="success"
                  title="Забрать право голоса"
                  aria-label="Забрать право голоса"
                  @click="handleRevokeSpeaking(item.identity)"
                >
                  <PixelIcon name="mic-on" variant="small" />
                </Indicator>
                <Indicator
                  v-else-if="
                    !previewMode &&
                    !conferenceHall.isLeader.value &&
                    getParticipantState(item.identity)?.hasSpeakingPermission &&
                    !getParticipantState(item.identity)?.isLeader
                  "
                  :trigger="false"
                  variant="success"
                  title="Право голоса"
                  aria-label="Право голоса"
                >
                  <PixelIcon name="mic-on" variant="small" />
                </Indicator>
              </template>
            </RoomParticipantsList>
          </div>
        </section>
      </aside>
    </div>

    <CallMenu @disconnect="handleDisconnect">
      <template #left>
        <Button
          v-if="!previewMode && !conferenceHall.isLeader.value"
          :class="{ warning: hasRaisedHand, default: !hasRaisedHand }"
          :title="hasRaisedHand ? 'Опустить руку' : 'Поднять руку'"
          @click="handleRaiseHand"
        >
          <PixelIcon name="hand" variant="large" />
        </Button>
        <Button
          :class="{
            active: mediaState.isAudioEnabled,
            danger: !mediaState.isAudioEnabled,
          }"
          :disabled="!canSpeak"
          :title="
            canSpeak
              ? mediaState.isAudioEnabled
                ? 'Выключить микрофон'
                : 'Включить микрофон'
              : 'Дождитесь разрешения от лидера говорить'
          "
          @click="handleToggleAudio"
        >
          <PixelIcon
            :name="mediaState.isAudioEnabled ? 'mic-on' : 'mic-off'"
            variant="large"
          />
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
          <PixelIcon
            :name="mediaState.isVideoEnabled ? 'video-on' : 'video-off'"
            variant="large"
          />
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
          <PixelIcon
            :name="mediaState.isScreenSharing ? 'screen-on' : 'screen-off'"
            variant="large"
          />
        </Button>
        <ReplicaInput
          v-if="!previewMode"
          @submit="sendReplica"
          :max-length="32"
        />
      </template>
      <template #right>
        <ParticipantsTrigger
          v-if="hideSidebar"
          :panel-open="showParticipantsPanel"
          :raised-count="raisedHandsSet.size"
          @toggle="showParticipantsPanel = !showParticipantsPanel"
        />
        <Button
          v-if="settingsInCallMenu"
          variant="default"
          size="small"
          title="Настройки"
          @click="handleSettings"
        >
          <PixelIcon name="settings" variant="large" />
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
          class="room-fullscreen__close"
          title="Закрыть полноэкранный режим"
          aria-label="Закрыть"
          @click="closeFullscreen"
        >
          <PixelIcon name="close" variant="large" />
        </Button>
        <div class="room-fullscreen__video">
          <VideoParticipant
            :participant="resolveParticipant(fullscreenParticipant)"
            :participant-name="
              isLocal(fullscreenParticipant)
                ? props.participantName
                : (props.getDisplayName?.(fullscreenParticipant) ??
                  fullscreenParticipant.name ??
                  fullscreenParticipant.identity)
            "
            :participant-color="fullscreenParticipantColor"
            :is-speaking="
              speakingIdentitySet.has(fullscreenParticipant.identity)
            "
            :is-leader="
              conferenceHall.stateSynced &&
              conferenceHall.leader.value?.identity ===
                fullscreenParticipant.identity
            "
            :replica-text="
              replicaByParticipant[fullscreenParticipant.identity]?.text
            "
          />
        </div>
        <CallMenu
          menu-class="room-fullscreen__menu"
          @disconnect="handleDisconnect"
        >
          <template #left>
            <Button
              v-if="!previewMode && !conferenceHall.isLeader.value"
              :class="{ warning: hasRaisedHand, default: !hasRaisedHand }"
              :title="hasRaisedHand ? 'Опустить руку' : 'Поднять руку'"
              @click="handleRaiseHand"
            >
              <PixelIcon name="hand" variant="large" />
            </Button>
            <Button
              :class="{
                active: mediaState.isAudioEnabled,
                danger: !mediaState.isAudioEnabled,
              }"
              :disabled="!canSpeak"
              :title="
                canSpeak
                  ? mediaState.isAudioEnabled
                    ? 'Выключить микрофон (M)'
                    : 'Включить микрофон (M)'
                  : 'Дождитесь разрешения от лидера говорить'
              "
              @click="handleToggleAudio"
            >
              <PixelIcon
                :name="mediaState.isAudioEnabled ? 'mic-on' : 'mic-off'"
                variant="large"
              />
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
              <PixelIcon
                :name="mediaState.isVideoEnabled ? 'video-on' : 'video-off'"
                variant="large"
              />
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
              <PixelIcon
                :name="mediaState.isScreenSharing ? 'screen-on' : 'screen-off'"
                variant="large"
              />
            </Button>
            <ReplicaInput
              v-if="!previewMode"
              @submit="sendReplica"
              :max-length="32"
            />
          </template>
          <template #right>
            <ParticipantsTrigger
              v-if="hideSidebar"
              :panel-open="showParticipantsPanel"
              :raised-count="raisedHandsSet.size"
              @toggle="showParticipantsPanel = !showParticipantsPanel"
            />
          </template>
        </CallMenu>
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

        <AudioSettings ref="audioSettingsRef" />
        <div class="settings-section">
          <h3 class="settings-section-title">Звуковые уведомления</h3>
          <div class="settings-item">
            <div class="settings-checkbox-group">
              <label class="settings-checkbox-label">
                <input
                  v-model="replicaTtsEnabled"
                  type="checkbox"
                  class="settings-checkbox checkbox-pixel"
                />
                <span>Озвучивать реплики (TTS)</span>
              </label>
            </div>
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
import { ref, computed, watch } from "vue";
import { useMediaControl } from "@features/media-control";
import { useConferenceHall } from "@features/conference-hall";
import { useE2EE } from "@features/e2ee";
import { useConnectionIndicator } from "@features/room-connection";
import {
  useParticipantReplica,
  ReplicaInput,
} from "@features/participant-replica";
import { Button, Modal, AudioSettings, PixelIcon, Indicator } from "@shared/ui";
import { VideoParticipant } from "@widgets/video-participant";
import { RoomParticipantsList } from "@widgets/room-participants-list";
import type { RoomParticipantListItem } from "@widgets/room-participants-list";
import { CallMenu } from "@widgets/call-menu";
import ParticipantsTrigger from "./ParticipantsTrigger.vue";
import {
  getAuthState,
  setParticipantName,
  getStoredAudioInputDevice,
  useMeetingHotkeys,
  useTauriGlobalShortcuts,
  playNotificationSound,
  getReplicaTtsEnabled,
  setReplicaTtsEnabled,
  speakReplicaText,
  parseParticipantColorFromMetadata,
} from "@shared/lib";
import type { ComponentPublicInstance } from "vue";
import type { Room as RoomEntity, RoomApi } from "@shared/entities";
import { RoomEvent, Track } from "livekit-client";
import type {
  Room as LiveKitRoom,
  RemoteParticipant,
  LocalParticipant,
} from "livekit-client";

const props = defineProps<{
  room: RoomEntity | null;
  roomApi?: RoomApi | null;
  livekitRoom: LiveKitRoom | null;
  localParticipant?: LocalParticipant | null;
  remoteParticipants?: RemoteParticipant[];
  getDisplayName?: (p: RemoteParticipant | LocalParticipant) => string;
  participantName: string;
  apiBaseURL: string;
  showDocument?: boolean;
  previewMode?: boolean;
  hideSidebar?: boolean;
  settingsInCallMenu?: boolean;
  settingsInUpperMenu?: boolean;
  updateParticipantName?: (name: string) => void;
}>();

const emit = defineEmits<{
  disconnect: [];
  "update:participantName": [name: string];
  "update:participants": [RoomParticipantListItem[]];
}>();

defineExpose({
  openCallSettings: handleSettings,
});

const { state: e2eeState } = useE2EE(() => props.livekitRoom);

const livekitRoomRef = computed(() => props.livekitRoom);
const {
  connectionStatus: _connectionStatus,
  connectionLabel: _connectionLabel,
} = useConnectionIndicator(livekitRoomRef);

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
  undefined,
  {
    initialLeaderIdentity: () => props.room?.conference_hall_leader_id ?? null,
    onLeaderChange: (leaderIdentity) => {
      const code = props.room?.short_code;
      if (code && props.roomApi) {
        props.roomApi
          .updateConferenceHallLeader(code, leaderIdentity)
          .catch(() => {});
      }
    },
  },
);

const replicaTtsEnabled = ref(getReplicaTtsEnabled());
const initialReplicaTtsEnabled = ref(replicaTtsEnabled.value);

const { replicaByParticipant, sendReplica } = useParticipantReplica(
  computed(() => props.livekitRoom),
  {
    raisedHands: () => conferenceHall.state.value.raisedHands,
    speakReplica: (text) => {
      if (replicaTtsEnabled.value) {
        speakReplicaText(text);
      }
    },
  },
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

const prevRaisedHands = ref<string[]>([]);
watch(
  () => conferenceHall.state.value.raisedHands,
  (raisedHands) => {
    if (!conferenceHall.isLeader.value || props.previewMode) {
      prevRaisedHands.value = raisedHands;
      return;
    }
    const prev = new Set(prevRaisedHands.value);
    const hasNewRaisedHand = raisedHands.some((id) => !prev.has(id));
    if (hasNewRaisedHand) {
      playNotificationSound("hand_raised").catch(() => {});
      if (props.hideSidebar) {
        showParticipantsPanel.value = true;
      }
    }
    prevRaisedHands.value = raisedHands;
  },
  { immediate: true },
);

// Слушаем изменения метаданных участников (включая имя)
watch(
  () => props.livekitRoom,
  (room) => {
    if (!room) return;

    const handleMetadataChanged = () => {
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

    const handleMetadataChanged = () => {
      conferenceHall.updateParticipants();
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

/** Единый список участников: лидер показывается и в этом списке, и отдельно в главном окне. */
const allParticipants = computed(() => {
  const list: (LocalParticipant | RemoteParticipant)[] = [];
  if (localParticipant.value) list.push(localParticipant.value);
  return [...list, ...remoteParticipants.value];
});

/** Прямая подписка на список поднятых рук, чтобы список участников гарантированно перерисовывался. */
const raisedHandsSet = ref<Set<string>>(new Set());
watch(
  () => conferenceHall.state.value.raisedHands,
  (raised) => {
    const next = new Set(Array.isArray(raised) ? raised : []);
    console.log("[RoomConferenceHall] raisedHands watch", {
      raised: Array.isArray(raised) ? raised : [],
      setSize: next.size,
    });
    raisedHandsSet.value = next;
  },
  { immediate: true },
);

const sidebarParticipantsListKey = computed(() => {
  const r = raisedHandsSet.value;
  return Array.from(r).sort().join(",") || "none";
});

const isLocal = (p: LocalParticipant | RemoteParticipant) =>
  localParticipant.value?.identity === p.identity;

function resolveParticipant(
  p: LocalParticipant | RemoteParticipant | null,
): LocalParticipant | RemoteParticipant | null {
  if (!p) return null;
  const room = props.livekitRoom;
  const fromRoom =
    room?.getParticipantByIdentity?.(p.identity) ??
    room?.remoteParticipants?.get?.(p.identity);
  return (fromRoom ?? p) as LocalParticipant | RemoteParticipant | null;
}

function isParticipantMicOn(
  p: LocalParticipant | RemoteParticipant | null,
): boolean {
  if (!p) return false;
  const participant = resolveParticipant(p);
  const micPub = participant?.getTrackPublication?.(Track.Source.Microphone) as
    | { isMuted?: boolean }
    | undefined;
  return Boolean(micPub && micPub.isMuted === false);
}

const sidebarParticipantList = computed<RoomParticipantListItem[]>(() => {
  const raised = raisedHandsSet.value;
  const participantsMap = conferenceHall.state.value.participants;
  if (props.previewMode && allParticipants.value.length === 0) {
    return [
      { identity: "preview-alice", participantName: "Alice" },
      { identity: "preview-bob", participantName: "Bob" },
    ];
  }
  return allParticipants.value.map((p) => {
    const state = participantsMap.get(p.identity);
    const hasRaised = raised.has(p.identity) || (state?.hasRaisedHand ?? false);
    const name = isLocal(p)
      ? props.participantName
      : (props.getDisplayName?.(p) ?? p.name ?? p.identity);
    return {
      identity: p.identity,
      participantName: name,
      participantColor: parseParticipantColorFromMetadata(
        (p as { metadata?: string }).metadata,
        name,
      ),
      participant: resolveParticipant(p),
      isSpeaking: speakingIdentitySet.value.has(p.identity),
      isLeader: conferenceHall.stateSynced && (state?.isLeader ?? false),
      hasRaisedHand: hasRaised,
      hasSpeakingPermission: state?.hasSpeakingPermission ?? false,
      isAudioEnabled: isParticipantMicOn(p),
      replicaText: replicaByParticipant.value[p.identity]?.text,
    };
  });
});

watch(sidebarParticipantList, (list) => emit("update:participants", list), {
  immediate: true,
  deep: true,
});

const fullscreenIdentity = ref<string | null>(null);

const fullscreenParticipant = computed(() => {
  const id = fullscreenIdentity.value;
  if (!id) return null;
  const leader = leaderParticipant.value;
  if (leader?.identity === id) return leader;
  return allParticipants.value.find((p) => p.identity === id) ?? null;
});

const leaderParticipantColor = computed(() => {
  const p = leaderParticipant.value;
  if (!p) return undefined;
  const name = isLocal(p)
    ? props.participantName
    : (props.getDisplayName?.(p) ?? p.name ?? p.identity);
  return parseParticipantColorFromMetadata(
    (p as { metadata?: string }).metadata,
    name,
  );
});

const fullscreenParticipantColor = computed(() => {
  const p = fullscreenParticipant.value;
  if (!p) return undefined;
  const name = isLocal(p)
    ? props.participantName
    : (props.getDisplayName?.(p) ?? p.name ?? p.identity);
  return parseParticipantColorFromMetadata(
    (p as { metadata?: string }).metadata,
    name,
  );
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

const hasSpeakingPermission = computed(() => {
  if (!localParticipant.value) return false;
  return (
    getParticipantState(localParticipant.value.identity)
      ?.hasSpeakingPermission ?? false
  );
});

/** Говорить может только лидер или участник, которому лидер выдал право голоса (поднятая рука — только заявка). */
const canSpeak = computed(
  () => conferenceHall.isLeader.value || hasSpeakingPermission.value,
);

const {
  state: mediaState,
  toggleVideo,
  toggleAudio,
  toggleScreenShare,
  switchAudioInputDevice,
} = useMediaControl(
  localParticipant,
  computed(() => props.livekitRoom),
);

/** При потере права говорить — выключаем микрофон */
const prevCanSpeak = ref(canSpeak.value);
watch(canSpeak, (speak) => {
  if (prevCanSpeak.value && !speak && mediaState.value.isAudioEnabled) {
    toggleAudio();
  }
  prevCanSpeak.value = speak;
});

const handleToggleAudio = () => {
  if (!canSpeak.value) return;
  toggleAudio();
};

const handleDisconnect = () => emit("disconnect");

useMeetingHotkeys({
  toggleAudio: handleToggleAudio,
  toggleVideo: () => {
    if (!props.previewMode && conferenceHall.isLeader.value) toggleVideo();
  },
  toggleScreenShare: () => {
    if (!props.previewMode && conferenceHall.isLeader.value)
      toggleScreenShare();
  },
  leaveRoom: handleDisconnect,
  enabled: () => !!props.livekitRoom,
});
useTauriGlobalShortcuts({
  toggleAudio: handleToggleAudio,
  toggleVideo,
  toggleScreenShare,
  leaveRoom: handleDisconnect,
  enabled: () => !!props.livekitRoom,
});

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

const isSettingsOpen = ref(false);
const showParticipantsPanel = ref(false);
const audioSettingsRef = ref<ComponentPublicInstance | null>(null);
const initialParticipantName = ref(props.participantName);
const settingsParticipantName = ref(props.participantName);

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

  return nameChanged || audioChanged || ttsChanged;
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

      // Обновляем имя в LiveKit (через connection — сразу и у других, и в нашем state)
      if (props.updateParticipantName) {
        props.updateParticipantName(newName);
      } else if (localParticipant.value) {
        try {
          await localParticipant.value.setName(newName);
        } catch (error) {
          console.error("❌ Ошибка при обновлении имени в LiveKit:", error);
          alert(
            "Не удалось обновить имя для других участников. " +
              "Возможно, требуется разрешение CanUpdateOwnMetadata в токене.",
          );
        }
      }

      // Обновляем состояние в conferenceHall (имя уже обновится через событие ParticipantMetadataChanged)
      // Но обновим сразу для локального отображения
      conferenceHall.updateParticipants();
    }

    let audioSettingsChanged = false;
    if (
      audioSettingsRef.value &&
      typeof (audioSettingsRef.value as any).getSettings === "function"
    ) {
      const currentSettings = (audioSettingsRef.value as any).getSettings();
      const savedInput = getStoredAudioInputDevice() || "";
      audioSettingsChanged = currentSettings.inputDevice !== savedInput;
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
        // Можно показать уведомление пользователю, но не блокируем сохранение
      }
    }

    if (replicaTtsEnabled.value !== initialReplicaTtsEnabled.value) {
      setReplicaTtsEnabled(replicaTtsEnabled.value);
      initialReplicaTtsEnabled.value = replicaTtsEnabled.value;
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

.conference-hall__content {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow: hidden;
  min-height: 0;
  padding-bottom: 100px;
}

@media (max-width: 768px) {
  .conference-hall__content {
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .conference-hall__main,
  .conference-hall__sidebar {
    flex-shrink: 0;
  }

  .conference-hall__sidebar {
    width: 100%;
    min-width: 0;
  }
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
  padding: 16px 8px 8px 8px;
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

.conference-hall__panel-overlay {
  position: fixed;
  inset: 0;
  z-index: 100001;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: flex-end;
}

.conference-hall__sidebar--panel {
  width: 340px;
  max-width: 100vw;
  height: 100%;
  background: var(--color-surface, #1f1f1f);
  border-left: 2px solid #444;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
  padding: 16px;
  overflow-y: auto;
}

.conference-hall__panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.conference-hall-panel-enter-active,
.conference-hall-panel-leave-active {
  transition: opacity 0.2s ease;
}
.conference-hall-panel-enter-active .conference-hall__sidebar--panel,
.conference-hall-panel-leave-active .conference-hall__sidebar--panel {
  transition: transform 0.2s ease;
}
.conference-hall-panel-enter-from,
.conference-hall-panel-leave-to {
  opacity: 0;
}
.conference-hall-panel-enter-from .conference-hall__sidebar--panel,
.conference-hall-panel-leave-to .conference-hall__sidebar--panel {
  transform: translateX(100%);
}
</style>
