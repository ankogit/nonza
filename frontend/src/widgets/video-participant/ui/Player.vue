<template>
  <div
    class="player bg-dark-20"
    :class="[
      { 'player--speaking': isSpeaking },
      mode === 'list' && 'player--list',
    ]"
  >
    <template v-if="mode === 'grid'">
      <div
        v-memo="[
          mode,
          previewMode,
          participant?.identity,
          videoTrack,
          participantName,
          showFullSize,
        ]"
        class="player-avatar"
      >
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

    <div class="player-menu bg-dark-blur-90">
      <div class="player-menu-inner">
        <div class="left">
          <div
            v-memo="nameReplicaMemo"
            class="player-menu__identity"
          >
            <div class="player-name color-white font-bebas">
              {{ nameReplica.participantName }}
            </div>
            <ReplicaBlock
              v-if="nameReplica.replicaText?.trim()"
              :text="nameReplica.replicaText"
            />
          </div>
          <span
            v-if="leaderHand.isLeader"
            v-memo="[leaderHand.isLeader]"
            class="indicator default"
            title="Лидер"
          >
            <PixelIcon name="leader" variant="small" />
          </span>
        </div>
        <div class="right">
          <template v-memo="[mode, hasRaisedHand]">
            <slot v-if="mode === 'list'" name="actions" />
            <span
              v-if="hasRaisedHand"
              class="indicator warning"
              title="Поднята рука"
            >
              <PixelIcon name="hand" variant="small" />
            </span>
          </template>
          <MicIndicator
            ref="micIndicatorRef"
            :is-audio-enabled="isAudioEnabled"
            :is-local-participant="isLocalParticipant"
            :is-volume-menu-open="isVolumeMenuOpen"
            :volume="volume"
            :volume-min="VOLUME_MIN"
            :volume-max="VOLUME_MAX"
            :show-volume-slider="!isLocalParticipant"
            :list-mode="true"
            @click="onListIndicatorClick"
            @volume-input="onVolumeInput"
          />
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
import { PixelIcon } from "@shared/ui";
import FullscreenIcon from "./FullscreenIcon.vue";
import MicIndicator from "./MicIndicator.vue";
import ReplicaBlock from "./ReplicaBlock.vue";
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
    isAudioEnabled?: boolean;
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

const nameReplica = ref({
  participantName: props.participantName ?? "",
  replicaText: props.replicaText ?? "",
});
const leaderHand = ref({
  isLeader: props.isLeader ?? false,
  hasRaisedHand: props.hasRaisedHand ?? false,
});
watch(
  () => ({
    participantName: props.participantName ?? "",
    replicaText: props.replicaText ?? "",
    isLeader: props.isLeader ?? false,
    hasRaisedHand: props.hasRaisedHand ?? false,
  }),
  (next) => {
    const prevNr = nameReplica.value;
    if (
      prevNr.participantName !== next.participantName ||
      prevNr.replicaText !== next.replicaText
    ) {
      nameReplica.value = {
        participantName: next.participantName,
        replicaText: next.replicaText,
      };
    }
    const prevLh = leaderHand.value;
    if (
      prevLh.isLeader !== next.isLeader ||
      prevLh.hasRaisedHand !== next.hasRaisedHand
    ) {
      leaderHand.value = {
        isLeader: next.isLeader,
        hasRaisedHand: next.hasRaisedHand,
      };
    }
  },
  { immediate: true },
);

const nameReplicaMemo = computed(
  () =>
    [nameReplica.value.participantName, nameReplica.value.replicaText] as const,
);

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

const isAudioEnabled = computed(() =>
  props.mode === "list" && props.isAudioEnabled !== undefined
    ? props.isAudioEnabled
    : tracksAudioEnabled.value,
);

const {
  volume,
  volumeMenuOpen,
  onVolumeInput,
  toggleVolumeMenu,
  VOLUME_MIN,
  VOLUME_MAX,
} = volumeApi;

const micIndicatorRef = ref<{ wrapEl: HTMLElement | null } | null>(null);

const isVolumeMenuOpen = computed(() => volumeMenuOpen.value);

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
      const wrapEl = micIndicatorRef.value?.wrapEl;
      if (wrapEl && !wrapEl.contains(e.target as Node)) {
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

/* Hidden audio for list mode: subscribe and play remote participant */
.player-audio-list-hidden {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
</style>
