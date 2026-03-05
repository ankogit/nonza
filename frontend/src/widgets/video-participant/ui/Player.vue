<template>
  <div
    class="player bg-dark-20"
    :class="[
      { 'player--speaking': isSpeaking },
      mode === 'list' && 'player--list',
      (pip === true) && 'player--pip',
    ]"
    :style="pip === true ? pipStyle : undefined"
    @pointerdown="pip === true ? onPipPointerDown : undefined"
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
            class="indicator warning"
            title="Лидер"
          >
            <PixelIcon name="leader" variant="small" />
          </span>
        </div>
        <div class="right">
          <slot v-if="mode === 'list'" name="actions" />
          <span
            v-if="hasRaisedHand"
            class="indicator warning"
            title="Поднята рука"
          >
            <PixelIcon name="hand" variant="small" />
          </span>
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
    <template v-if="pip === true">
      <div
        data-pip-resize-handle
        class="player-pip-resize"
        title="Изменить размер"
        @pointerdown.stop="onPipResize?.(($event as PointerEvent))"
      />
      <Button
        v-if="onPipClose"
        class="player-pip-close"
        size="small"
        variant="default"
        icon-size="28px"
        aria-label="Скрыть"
        title="Скрыть миниатюру"
        @click.stop="onPipClose"
      >
        <PixelIcon name="close" variant="small" />
      </Button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, nextTick, type Ref } from "vue";
import type {
  RemoteParticipant,
  LocalParticipant,
  RemoteAudioTrack,
} from "livekit-client";
import { Button, PixelIcon } from "@shared/ui";
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
    pip?: boolean;
    pipStyle?: { left: string; top: string; width: string; height: string };
    onPipDrag?: (e: PointerEvent) => void;
    onPipResize?: (e: PointerEvent) => void;
    onPipClose?: () => void;
  }>(),
  {
    participant: null,
    isSpeaking: false,
    previewMode: false,
    isLeader: false,
    hasRaisedHand: false,
    hasSpeakingPermission: false,
    showFullSize: false,
    pip: false,
  },
);

const emit = defineEmits<{ "full-size": [] }>();

function onPipPointerDown(e: PointerEvent) {
  if ((e.target as HTMLElement).closest("button")) return;
  if ((e.target as HTMLElement).closest("[data-pip-resize-handle]")) return;
  e.preventDefault();
  props.onPipDrag?.(e);
}

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

.player--pip {
  position: fixed;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 2px solid #444;
  box-shadow: 4px 4px 12px rgba(0, 0, 0, 0.5);
  background: #1a1a1a;
  min-width: 160px;
  min-height: 90px;
  width: auto;
  height: auto;
  cursor: move;
}

.player--pip .player-menu {
  flex-shrink: 0;
}

.player--pip .player-avatar {
  flex: 1;
  min-height: 0;
}

.player-pip-resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 28px;
  height: 28px;
  z-index: 10;
  cursor: nwse-resize;
  background: #333;
  pointer-events: auto;
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
}

.player-pip-resize:hover {
  background: #555;
}

.player-pip-close {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 10;
  pointer-events: auto;
}
</style>
