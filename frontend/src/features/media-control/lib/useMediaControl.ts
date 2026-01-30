import { ref, computed, watch, nextTick, type ComputedRef } from 'vue'
import type { LocalParticipant, LocalTrackPublication } from 'livekit-client'
import { Track, ParticipantEvent } from 'livekit-client'
import { getStoredAudioInputDevice, getDefaultAudioConstraints } from '@shared/lib'

export interface MediaControlState {
  isVideoEnabled: boolean
  isAudioEnabled: boolean
  isScreenSharing: boolean
  videoDeviceId: string | null
  audioDeviceId: string | null
}

export function useMediaControl(participant: ComputedRef<LocalParticipant | null>) {
  const state = ref<MediaControlState>({
    isVideoEnabled: false,
    isAudioEnabled: false,
    isScreenSharing: false,
    videoDeviceId: null,
    audioDeviceId: null
  })

  const updateState = () => {
    if (!participant.value) {
      state.value.isVideoEnabled = false
      state.value.isAudioEnabled = false
      state.value.isScreenSharing = false
      return
    }

    const p = participant.value
    const videoPubs = Array.from(p.videoTrackPublications.values())
    const cameraPub = videoPubs.find((pub) => pub.source === Track.Source.Camera)
    const audioPub = Array.from(p.audioTrackPublications.values())[0]
    const screenPub = Array.from(p.trackPublications.values()).find(
      (pub) => pub.source === Track.Source.ScreenShare
    )

    state.value.isVideoEnabled = (cameraPub?.isMuted === false && !!cameraPub?.track) === true
    state.value.isAudioEnabled = (audioPub?.isMuted === false && !!audioPub?.track) === true
    state.value.isScreenSharing = !!screenPub?.track
  }

  let cleanup: (() => void) | null = null
  watch(
    participant,
    (p) => {
      if (cleanup) {
        cleanup()
        cleanup = null
      }
      updateState()
      if (!p) return
      const onTrackChange = () => nextTick(updateState)
      p.on(ParticipantEvent.LocalTrackPublished, onTrackChange)
      p.on(ParticipantEvent.LocalTrackUnpublished, onTrackChange)
      cleanup = () => {
        p.off(ParticipantEvent.LocalTrackPublished, onTrackChange)
        p.off(ParticipantEvent.LocalTrackUnpublished, onTrackChange)
      }
    },
    { immediate: true }
  )

  const toggleVideo = async (): Promise<void> => {
    if (!participant.value) return

    const cameraPub = Array.from(participant.value.videoTrackPublications.values()).find(
      (pub) => pub.source === Track.Source.Camera
    ) as LocalTrackPublication | undefined

    if (cameraPub?.track) {
      if (state.value.isVideoEnabled) {
        await cameraPub.track.stop()
        await participant.value.unpublishTrack(cameraPub.track)
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        const videoTracks = stream.getVideoTracks()
        if (videoTracks.length > 0) {
          await participant.value.publishTrack(videoTracks[0], { source: Track.Source.Camera })
        }
      }
      nextTick(updateState)
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      const videoTracks = stream.getVideoTracks()
      if (videoTracks.length > 0) {
        await participant.value.publishTrack(videoTracks[0], { source: Track.Source.Camera })
        nextTick(updateState)
      }
    }
  }

  const toggleAudio = async (): Promise<void> => {
    if (!participant.value) return

    const audioTrack = participant.value.audioTrackPublications.values().next().value as LocalTrackPublication | undefined

    if (audioTrack?.track) {
      if (state.value.isAudioEnabled) {
        await audioTrack.track.stop()
        await participant.value.unpublishTrack(audioTrack.track)
      } else {
        const storedDeviceId = getStoredAudioInputDevice()
        const constraints: MediaStreamConstraints = {
          audio: getDefaultAudioConstraints(storedDeviceId ?? undefined),
        }
        const track = await navigator.mediaDevices.getUserMedia(constraints)
        const audioTracks = track.getAudioTracks()
        if (audioTracks.length > 0) {
          await participant.value.publishTrack(audioTracks[0], { source: Track.Source.Microphone })
        }
      }
      nextTick(updateState)
    } else {
      // Enable audio
      const storedDeviceId = getStoredAudioInputDevice()
      const constraints: MediaStreamConstraints = {
        audio: getDefaultAudioConstraints(storedDeviceId ?? undefined),
      }
      const track = await navigator.mediaDevices.getUserMedia(constraints)
      const audioTracks = track.getAudioTracks()
      if (audioTracks.length > 0) {
        await participant.value.publishTrack(audioTracks[0], { source: Track.Source.Microphone })
        nextTick(updateState)
      }
    }
  }

  const toggleScreenShare = async (): Promise<void> => {
    if (!participant.value) return

    if (state.value.isScreenSharing) {
      // Stop screen sharing
      const screenTrack = Array.from(participant.value.trackPublications.values())
        .find((pub) => pub.source === Track.Source.ScreenShare) as LocalTrackPublication | undefined

      if (screenTrack?.track) {
        await screenTrack.track.stop()
        await participant.value.unpublishTrack(screenTrack.track)
        nextTick(updateState)
      }
    } else {
      // Start screen sharing
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        })

        const videoTracks = stream.getVideoTracks()
        if (videoTracks.length > 0) {
          await participant.value.publishTrack(videoTracks[0], { source: Track.Source.ScreenShare })
          nextTick(updateState)

          // Stop screen sharing when user stops it
          videoTracks[0].onended = () => {
            toggleScreenShare()
          }
        }
      } catch (error) {
        console.error('Failed to start screen sharing:', error)
      }
    }
  }

  /**
   * Переключает устройство ввода для активного микрофона
   * Если микрофон не активен, ничего не делает
   */
  const switchAudioInputDevice = async (): Promise<void> => {
    if (!participant.value || !state.value.isAudioEnabled) {
      return;
    }

    const audioTrack = participant.value.audioTrackPublications.values().next().value as LocalTrackPublication | undefined;
    
    if (!audioTrack?.track) {
      return;
    }

    try {
      // Останавливаем текущий трек
      await audioTrack.track.stop();
      await participant.value.unpublishTrack(audioTrack.track);

      // Получаем новое устройство из настроек
      const storedDeviceId = getStoredAudioInputDevice();
      const constraints: MediaStreamConstraints = {
        audio: getDefaultAudioConstraints(storedDeviceId ?? undefined),
      };

      // Создаем новый трек с новым устройством
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const audioTracks = stream.getAudioTracks();
      
      if (audioTracks.length > 0) {
        await participant.value.publishTrack(audioTracks[0], { source: Track.Source.Microphone });
        nextTick(updateState);
      }
    } catch (error) {
      console.error("Failed to switch audio input device:", error);
      // В случае ошибки пытаемся восстановить микрофон
      try {
        const constraints: MediaStreamConstraints = {
          audio: getDefaultAudioConstraints(),
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          await participant.value.publishTrack(audioTracks[0], { source: Track.Source.Microphone });
          nextTick(updateState);
        }
      } catch (recoveryError) {
        console.error("Failed to recover audio:", recoveryError);
      }
    }
  };

  return {
    state: computed(() => state.value),
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
    switchAudioInputDevice
  }
}
