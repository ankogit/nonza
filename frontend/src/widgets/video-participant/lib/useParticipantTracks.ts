import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { ParticipantEvent, LocalParticipant, Track } from "livekit-client";
import type { RemoteParticipant, RemoteAudioTrack } from "livekit-client";
import { applyStoredOutputDevice } from "@shared/lib";

type ParticipantLike = RemoteParticipant | LocalParticipant | null;

function isRemoteParticipant(
  p: ParticipantLike,
): p is RemoteParticipant {
  return p !== null && !(p instanceof LocalParticipant);
}

function checkIsLocal(participant: ParticipantLike): boolean {
  if (!participant) return false;
  try {
    if (LocalParticipant && typeof LocalParticipant === "function") {
      return participant instanceof LocalParticipant;
    }
    return typeof (participant as { publishTrack?: unknown }).publishTrack === "function";
  } catch {
    return typeof (participant as { publishTrack?: unknown }).publishTrack === "function";
  }
}

export type UseParticipantTracksProps = {
  participant: ParticipantLike;
  participantName: string;
  previewMode?: boolean;
};

export function useParticipantTracks(props: UseParticipantTracksProps) {
  const videoElement = ref<HTMLVideoElement | null>(null);
  const audioElement = ref<HTMLAudioElement | null>(null);
  const videoTrack = ref<MediaStreamTrack | null>(null);
  const audioTrack = ref<MediaStreamTrack | null>(null);
  const remoteLiveKitAudioTrack = ref<RemoteAudioTrack | null>(null);
  const isAudioEnabled = ref(true);

  const isLocalParticipant = computed(() => checkIsLocal(props.participant));

  function doAttachVideoTrack(track: MediaStreamTrack) {
    if (!videoElement.value || !track) return;
    if (videoElement.value.srcObject) {
      const oldStream = videoElement.value.srcObject as MediaStream;
      oldStream.getTracks().forEach((t) => {
        if (t !== track) t.stop();
      });
    }
    videoElement.value.srcObject = new MediaStream([track]);
    videoTrack.value = track;
    videoElement.value.load();
    videoElement.value.play().catch(() => {});
  }

  async function doAttachAudioTrack(track: MediaStreamTrack) {
    if (!audioElement.value || !track) return;
    if (audioElement.value.srcObject) {
      const oldStream = audioElement.value.srcObject as MediaStream;
      oldStream.getTracks().forEach((t) => t.stop());
    }
    audioElement.value.srcObject = new MediaStream([track]);
    audioTrack.value = track;
    await applyStoredOutputDevice(audioElement.value);
    audioElement.value.load();
    audioElement.value.play().catch(() => {});
  }

  function updateTracks() {
    const participant = props.participant;
    const previewMode = props.previewMode ?? false;

    if (!participant || previewMode) {
      videoTrack.value = null;
      audioTrack.value = null;
      remoteLiveKitAudioTrack.value = null;
      isAudioEnabled.value = true;
      return;
    }

    try {
      type VideoPub = {
        source: Track.Source;
        track?: { mediaStreamTrack: MediaStreamTrack };
        isSubscribed?: boolean;
        isMuted?: boolean;
      };
      const vmap = participant.videoTrackPublications;
      const videoPubs: VideoPub[] = Array.from(vmap.values() as unknown as Iterable<VideoPub>);
      const videoPub =
        videoPubs.find((p) => p.source === Track.Source.ScreenShare && p.track) ??
        videoPubs.find((p) => p.source === Track.Source.Camera);
      const videoTrackEnded = videoPub?.track?.mediaStreamTrack?.readyState === "ended";
      const videoPubEffective = videoTrackEnded ? undefined : videoPub;

      const audioPub =
        participant.audioTrackPublications.size > 0
          ? (
              Array.from(
                participant.audioTrackPublications.values() as unknown as Iterable<unknown>,
              ) as { track?: { mediaStreamTrack: MediaStreamTrack }; isSubscribed?: boolean; isMuted?: boolean }[]
            )[0]
          : undefined;

      const isLocal = checkIsLocal(participant);

      if (isLocal) {
        if (videoPubEffective?.track) {
          videoTrack.value = videoPubEffective.track.mediaStreamTrack;
        } else {
          videoTrack.value = null;
          if (videoElement.value) videoElement.value.srcObject = null;
        }
      } else {
        if (videoPubEffective?.track && videoPubEffective.isSubscribed) {
          videoTrack.value = videoPubEffective.track.mediaStreamTrack;
        } else {
          videoTrack.value = null;
          if (videoElement.value) videoElement.value.srcObject = null;
        }
      }

      if (isLocal) {
        audioTrack.value = null;
        remoteLiveKitAudioTrack.value = null;
        if (audioElement.value) audioElement.value.srcObject = null;
      } else {
        if (audioPub?.track && audioPub.isSubscribed) {
          remoteLiveKitAudioTrack.value = audioPub.track as RemoteAudioTrack;
          audioTrack.value = null;
        } else {
          remoteLiveKitAudioTrack.value = null;
          audioTrack.value = null;
          if (audioElement.value) audioElement.value.srcObject = null;
        }
      }

      isAudioEnabled.value = audioPub ? audioPub.isMuted === false && !!audioPub.track : false;
    } catch {
      videoTrack.value = null;
      audioTrack.value = null;
      remoteLiveKitAudioTrack.value = null;
      isAudioEnabled.value = true;
    }
  }

  onMounted(() => {
    if ((props.previewMode ?? false) || !props.participant) {
      videoTrack.value = null;
      isAudioEnabled.value = true;
      return;
    }
    const participant = props.participant;
    updateTracks();
    participant.on("trackSubscribed", () => updateTracks());
    participant.on("trackUnsubscribed", () => updateTracks());
    participant.on("trackPublished", (publication: { trackSid?: string; isSubscribed?: boolean; setSubscribed?(v: boolean): void }) => {
      if (!checkIsLocal(participant) && isRemoteParticipant(participant) && publication.trackSid && !publication.isSubscribed) {
        publication.setSubscribed?.(true);
      }
      updateTracks();
    });
    participant.on("trackUnpublished", () => updateTracks());
    participant.on(ParticipantEvent.TrackMuted, () => updateTracks());
    participant.on(ParticipantEvent.TrackUnmuted, () => updateTracks());
  });

  watch(
    () => props.participant,
    (p) => {
      if (p && !(props.previewMode ?? false)) updateTracks();
    },
    { immediate: true, deep: true },
  );

  watch(
    () => [videoElement.value, videoTrack.value] as const,
    ([el, track]) => {
      if (el && track && !(props.previewMode ?? false)) {
        nextTick(() => doAttachVideoTrack(track));
      }
    },
    { immediate: true, deep: true },
  );

  watch(
    () => [audioElement.value, audioTrack.value, isLocalParticipant.value, remoteLiveKitAudioTrack.value] as const,
    async ([el, track, isLocal, remote]) => {
      if (!el || (props.previewMode ?? false) || isLocal) return;
      if (remote) {
        // Применяем устройство вывода для удаленного аудио
        await applyStoredOutputDevice(el);
        return;
      }
      if (track) nextTick(() => doAttachAudioTrack(track));
    },
    { immediate: true, deep: true },
  );

  onUnmounted(() => {
    if (videoElement.value?.srcObject) {
      const stream = videoElement.value.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoElement.value.srcObject = null;
    }
    if (audioElement.value?.srcObject) {
      const stream = audioElement.value.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      audioElement.value.srcObject = null;
    }
  });

  return {
    videoElement,
    audioElement,
    videoTrack,
    audioTrack,
    remoteLiveKitAudioTrack,
    isLocalParticipant,
    isAudioEnabled,
    updateTracks,
    doAttachVideoTrack,
    doAttachAudioTrack,
  };
}
