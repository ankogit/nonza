<template>
  <div
    class="player bg-dark-20"
    :class="[
      { 'player--speaking': isSpeaking },
      mode === 'list' && 'player--list',
    ]"
  >
    <!-- Grid: video/avatar + fullscreen -->
    <template v-if="mode === 'grid'">
      <div class="player-avatar">
        <video
          v-if="!previewMode && participant"
          :ref="tracks.videoElement"
          :muted="isLocalParticipant"
          autoplay
          playsinline
          :style="{ display: videoTrack ? 'block' : 'none' }"
        />
        <audio
          v-if="!isLocalParticipant && !previewMode && participant"
          :ref="tracks.audioElement"
          autoplay
          playsinline
        />
        <div
          v-if="!videoTrack || previewMode"
          class="player-avatar__placeholder"
        >
          <span class="player-avatar__letter">{{
            participantName.charAt(0).toUpperCase()
          }}</span>
        </div>
      </div>
      <FullscreenIcon v-if="showFullSize" @click="emit('full-size')" />
    </template>
    <!-- List mode: hidden audio for remote participants so we subscribe and hear them -->
    <audio
      v-if="
        mode === 'list' && !isLocalParticipant && !previewMode && participant
      "
      :ref="tracks.audioElement"
      autoplay
      playsinline
      class="player-audio-list-hidden"
      aria-hidden="true"
    />

    <!-- Menu: same structure for grid and list -->
    <div class="player-menu bg-dark-blur-90">
      <div class="player-menu-inner">
        <div class="left">
          <div class="player-name color-white font-bebas">
            {{ participantName }}
          </div>
          <div v-if="replicaText?.trim()" class="player-replica-wrap">
            <SpeechBubble :text="replicaText" />
          </div>
          <span v-if="isLeader" class="indicator default" title="Лидер">
            👑
          </span>
        </div>
        <div class="right">
          <!-- List: actions slot (grant/revoke speaking, etc.) -->
          <slot v-if="mode === 'list'" name="actions" />
          <span
            v-if="hasRaisedHand"
            class="indicator warning"
            title="Поднята рука"
          >
            ✋
          </span>
          <!-- Список: индикатор микрофона для всех; громкость только у удалённых -->
          <div
            v-if="mode === 'list' && !previewMode && participant"
            ref="volumeWrapRef"
            class="volume-indicator-wrap"
            :class="{ 'volume-indicator-wrap--open': isVolumeMenuOpen }"
          >
            <div v-if="!isLocalParticipant" class="volume-menu">
              <input
                type="range"
                class="volume-slider"
                :min="VOLUME_MIN"
                :max="VOLUME_MAX"
                step="5"
                :value="volume"
                :title="`${volume}%`"
                @input="onVolumeInput"
              />
            </div>
            <button
              type="button"
              class="indicator"
              :class="[
                isAudioEnabled ? 'success' : 'danger',
                { 'indicator--trigger': !isLocalParticipant },
              ]"
              :title="
                isLocalParticipant
                  ? isAudioEnabled
                    ? 'Микрофон вкл'
                    : 'Микрофон выкл'
                  : isVolumeMenuOpen
                    ? 'Скрыть громкость'
                    : 'Громкость'
              "
              aria-label="Микрофон"
              @click="onListIndicatorClick"
            >
              {{ isAudioEnabled ? "🔊" : "🔇" }}
            </button>
          </div>
          <!-- Grid: громкость только у удалённых -->
          <div
            v-if="
              mode === 'grid' &&
              !isLocalParticipant &&
              !previewMode &&
              participant
            "
            ref="volumeWrapRef"
            class="volume-indicator-wrap"
            :class="{ 'volume-indicator-wrap--open': isVolumeMenuOpen }"
          >
            <div class="volume-menu">
              <input
                type="range"
                class="volume-slider"
                :min="VOLUME_MIN"
                :max="VOLUME_MAX"
                step="5"
                :value="volume"
                :title="`${volume}%`"
                @input="onVolumeInput"
              />
            </div>
            <button
              type="button"
              class="indicator indicator--trigger"
              :class="isAudioEnabled ? 'success' : 'danger'"
              :title="isVolumeMenuOpen ? 'Скрыть громкость' : 'Громкость'"
              aria-label="Громкость"
              @click="onVolumeButtonClick"
            >
              🔊
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, nextTick, type Ref } from "vue";
import type {
  RemoteParticipant,
  LocalParticipant,
  RemoteAudioTrack,
} from "livekit-client";
import FullscreenIcon from "./FullscreenIcon.vue";
import SpeechBubble from "./SpeechBubble.vue";
import {
  useParticipantTracks,
  type UseParticipantTracksProps,
} from "../lib/useParticipantTracks";
import { useRemoteAudioVolume } from "../lib/useRemoteAudioVolume";

const props = withDefaults(
  defineProps<{
    mode: "grid" | "list";
    participant?: RemoteParticipant | LocalParticipant | null;
    participantName: string;
    isSpeaking?: boolean;
    previewMode?: boolean;
    isLeader?: boolean;
    hasRaisedHand?: boolean;
    hasSpeakingPermission?: boolean;
    showFullSize?: boolean;
    /** Only for list mode: show mic indicator when participant has no tracks in this component */
    isAudioEnabled?: boolean;
    /** Short message/replica shown under the participant name (e.g. when they can't speak) */
    replicaText?: string;
  }>(),
  {
    participant: null,
    isSpeaking: false,
    previewMode: false,
    isLeader: false,
    hasRaisedHand: false,
    hasSpeakingPermission: false,
    showFullSize: false,
  },
);

const emit = defineEmits<{ "full-size": [] }>();

// Reactive props for useParticipantTracks (only used in grid mode; list mode passes participant: null)
const tracksProps = reactive<UseParticipantTracksProps>({
  participant: null,
  participantName: props.participantName,
  previewMode: true,
});

watch(
  () =>
    [
      props.mode,
      props.participant,
      props.participantName,
      props.previewMode,
    ] as const,
  ([mode, participant, participantName, previewMode]) => {
    if (mode === "grid") {
      tracksProps.participant = participant ?? null;
      tracksProps.participantName = participantName;
      tracksProps.previewMode = previewMode ?? false;
    } else {
      // List mode: still pass remote participant so we subscribe and play their audio
      tracksProps.participant = participant ?? null;
      tracksProps.participantName = participantName;
      tracksProps.previewMode = previewMode ?? false;
    }
  },
  { immediate: true },
);

const tracks = useParticipantTracks(tracksProps as UseParticipantTracksProps);
const volumeApi = useRemoteAudioVolume({
  remoteLiveKitAudioTrack:
    tracks.remoteLiveKitAudioTrack as Ref<RemoteAudioTrack | null>,
  audioElement: tracks.audioElement,
  previewMode: computed(() => props.previewMode ?? false),
  participantIdentity:
    props.participant && !tracks.isLocalParticipant.value
      ? (props.participant as { identity: string }).identity
      : undefined,
});

const {
  videoTrack,
  isLocalParticipant,
  isAudioEnabled: tracksAudioEnabled,
} = tracks;

/** В списке — из пропа (родитель читает из комнаты). В сетке — из треков. */
const isAudioEnabled = computed(() =>
  props.mode === "list" && props.isAudioEnabled !== undefined
    ? props.isAudioEnabled
    : tracksAudioEnabled.value,
);

const {
  volume,
  volumeMenuOpen,
  volumeWrapRef,
  onVolumeInput,
  toggleVolumeMenu,
  VOLUME_MIN,
  VOLUME_MAX,
} = volumeApi;

const isVolumeMenuOpen = computed(() => volumeMenuOpen.value);

function onVolumeButtonClick(e: MouseEvent) {
  e.stopPropagation();
  toggleVolumeMenu();
}

function onListIndicatorClick(e: MouseEvent) {
  e.stopPropagation();
  if (!isLocalParticipant.value) toggleVolumeMenu();
}

const volumeOutsideHandlerRef = ref<((e: MouseEvent) => void) | null>(null);
watch(
  volumeMenuOpen,
  (open) => {
    if (volumeOutsideHandlerRef.value) {
      document.removeEventListener("click", volumeOutsideHandlerRef.value);
      volumeOutsideHandlerRef.value = null;
    }
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        volumeWrapRef.value &&
        !volumeWrapRef.value.contains(e.target as Node)
      ) {
        volumeMenuOpen.value = false;
      }
    };
    volumeOutsideHandlerRef.value = handler;
    nextTick(() => document.addEventListener("click", handler));
  },
  { immediate: true },
);
</script>

<style scoped>
.player--speaking {
  box-shadow: 0 0 0 2px #415526;
}

/* List mode: no fixed size, no avatar, menu is the full row */
.player--list {
  width: 100%;
  height: auto;
  min-height: 0;
  position: relative;
}

.player--list .player-menu {
  position: relative;
}

.player-replica-wrap {
  min-width: 0;
  position: absolute;
  align-self: flex-start;
  left: 0;
  bottom: 32px;
  max-width: min(280px, 100%);
}

.player-avatar video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.player-avatar__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2980b9;
}

.player-avatar__letter {
  color: #fff;
  font-size: 4rem;
  font-weight: 600;
  font-family: "Bebas Neue", sans-serif;
}

.player-menu .indicator {
  font-size: 0.875rem;
}

/* Volume: wrap is positioning context; menu animates translateX(0) → translateX(-24px) when open */
.player-menu :deep(.volume-indicator-wrap) {
  position: relative;
}

.player-menu :deep(.volume-menu) {
  position: absolute;
  right: 0;
  top: 0;
  width: 100px;
  min-width: 100px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2.5px);
  z-index: 21;
  transform: translateX(0px) translateY(0);
  visibility: hidden;
  pointer-events: none;
  opacity: 0;
  transition:
    transform 0.2s ease,
    opacity 0.2s ease,
    visibility 0.2s;
}

.player-menu :deep(.volume-indicator-wrap--open .volume-menu) {
  transform: translateX(-24px) translateY(0);
  visibility: visible;
  pointer-events: auto;
  opacity: 1;
}
.player-menu :deep(.volume-indicator-wrap .indicator) {
  z-index: 40;
}

/* Цвет индикатора громкости по состоянию микрофона (success/danger из design.css могут не доходить из-за scoped) */
.player-menu :deep(.volume-indicator-wrap .indicator--trigger.success) {
  background: #0ead61;
}
.player-menu :deep(.volume-indicator-wrap .indicator--trigger.danger) {
  background: #e2534b;
}

/* Hidden audio for list mode: subscribe and play remote participant */
.player-audio-list-hidden {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
</style>
