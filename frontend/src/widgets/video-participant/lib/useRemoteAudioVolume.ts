import { ref, watch, nextTick, onUnmounted, type Ref } from "vue";
import type { RemoteAudioTrack } from "livekit-client";
import {
  getVolumeForParticipant,
  setVolumeForParticipant,
  applyStoredOutputDevice,
} from "@shared/lib";

const VOLUME_MIN = 0;
const VOLUME_MAX = 500;

export type UseRemoteAudioVolumeOptions = {
  remoteLiveKitAudioTrack: Ref<RemoteAudioTrack | null>;
  audioElement: Ref<HTMLAudioElement | null>;
  previewMode: Ref<boolean>;
  /** Participant identity for persisting volume per participant */
  participantIdentity?: string | null;
};

export function useRemoteAudioVolume(options: UseRemoteAudioVolumeOptions) {
  const {
    remoteLiveKitAudioTrack,
    audioElement,
    previewMode,
    participantIdentity,
  } = options;
  const previewModeVal = () => previewMode.value;

  const initialVolume =
    participantIdentity != null
      ? getVolumeForParticipant(participantIdentity)
      : 100;
  const volume = ref(initialVolume);
  const volumeMenuOpen = ref(false);
  const volumeWrapRef = ref<HTMLElement | null>(null);

  const volumeAudioContextRef = ref<AudioContext | null>(null);
  const volumeGainNodeRef = ref<GainNode | null>(null);
  const volumeSourceNodeRef = ref<MediaStreamAudioSourceNode | null>(null);

  function setupVolumeGraphWithContext(track: RemoteAudioTrack, ctx: AudioContext): boolean {
    try {
      const gainValue = Math.min(5, Math.max(0, volume.value / 100));
      const stream = new MediaStream([track.mediaStreamTrack]);
      const source = ctx.createMediaStreamSource(stream);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gainValue, ctx.currentTime);
      source.connect(gain);
      gain.connect(ctx.destination);
      volumeAudioContextRef.value = ctx;
      volumeGainNodeRef.value = gain;
      volumeSourceNodeRef.value = source;
      return ctx.state === "running";
    } catch (err) {
      console.warn("[VP:vol] setupVolumeGraphWithContext failed:", err);
      return false;
    }
  }

  function teardownVolumeGraph() {
    try {
      if (volumeSourceNodeRef.value && volumeGainNodeRef.value) {
        volumeSourceNodeRef.value.disconnect();
        volumeGainNodeRef.value.disconnect();
      }
      volumeSourceNodeRef.value = null;
      volumeGainNodeRef.value = null;
      if (volumeAudioContextRef.value?.state !== "closed") {
        volumeAudioContextRef.value?.close();
      }
      volumeAudioContextRef.value = null;
    } catch {
      /* ignore */
    }
  }

  function applyRemoteAudioOutput() {
    const t = remoteLiveKitAudioTrack.value;
    if (!t || previewModeVal()) return;
    const vol = volume.value;
    const wantGraph = vol > 100;

    if (wantGraph) {
      const el = audioElement.value;
      if (el) el.volume = 0;
      teardownVolumeGraph();
      const ctx = new AudioContext();
      setupVolumeGraphWithContext(t, ctx);
      ctx.resume();
      return;
    }
    teardownVolumeGraph();
    const el = audioElement.value;
    if (el) {
      try {
        (t as { attach(el: HTMLMediaElement): HTMLMediaElement }).attach(el);
        t.setVolume(vol / 100);
        applyStoredOutputDevice(el);
      } catch (err) {
        console.warn("[VP:vol] attach failed:", err);
      }
    }
  }

  function toggleVolumeMenu() {
    volumeMenuOpen.value = !volumeMenuOpen.value;
    volumeAudioContextRef.value?.resume();
  }

  function onVolumeInput(e: Event) {
    const t = e.target as HTMLInputElement;
    if (!t) return;
    const v = Math.min(VOLUME_MAX, Math.max(VOLUME_MIN, Number(t.value)));
    volume.value = v;
    if (participantIdentity != null) {
      setVolumeForParticipant(participantIdentity, v);
    }
    volumeAudioContextRef.value?.resume();
    if (!remoteLiveKitAudioTrack.value) return;
    if (v > 100) {
      if (volumeGainNodeRef.value) {
        const gainValue = Math.min(5, Math.max(0, v / 100));
        const ctx = volumeGainNodeRef.value.context;
        volumeGainNodeRef.value.gain.setValueAtTime(gainValue, ctx.currentTime);
      } else {
        applyRemoteAudioOutput();
      }
      return;
    }
    if (volumeGainNodeRef.value) {
      applyRemoteAudioOutput();
    } else {
      const track = remoteLiveKitAudioTrack.value;
      if (track) track.setVolume(v / 100);
    }
  }

  watch(remoteLiveKitAudioTrack, (newTrack, oldTrack) => {
    if (oldTrack) {
      teardownVolumeGraph();
      const el = audioElement.value;
      if (el) {
        try {
          (oldTrack as { detach(el?: HTMLMediaElement): void }).detach(el);
        } catch {
          /* ignore */
        }
      } else {
        try {
          (oldTrack as { detach(): void }).detach();
        } catch {
          /* ignore */
        }
      }
    }
    if (newTrack && !previewModeVal()) {
      nextTick(() => applyRemoteAudioOutput());
    }
  });

  watch(audioElement, (element) => {
    if (!element || previewModeVal()) return;
    if (remoteLiveKitAudioTrack.value) {
      nextTick(() => applyRemoteAudioOutput());
    }
  });

  onUnmounted(teardownVolumeGraph);

  return {
    volume,
    volumeMenuOpen,
    volumeWrapRef,
    onVolumeInput,
    toggleVolumeMenu,
    teardownVolumeGraph,
    VOLUME_MIN,
    VOLUME_MAX,
  };
}
