<template>
  <Player
    mode="grid"
    :participant="participant"
    :participant-name="participantName"
    :participant-color="participantColor"
    :is-speaking="isSpeaking"
    :preview-mode="previewMode"
    :is-leader="isLeader"
    :has-raised-hand="hasRaisedHand"
    :has-speaking-permission="hasSpeakingPermission"
    :show-full-size="showFullSize"
    :replica-text="replicaText"
    :preferred-video-source="preferredVideoSource"
    :on-tracks-updated="onTracksUpdated"
    :pip="false"
    @full-size="emit('full-size')"
  />
</template>

<script setup lang="ts">
import type { RemoteParticipant, LocalParticipant } from "livekit-client";
import Player from "./Player.vue";

defineProps<{
  participant: RemoteParticipant | LocalParticipant | null;
  participantName: string;
  participantColor?: string;
  isSpeaking?: boolean;
  previewMode?: boolean;
  isLeader?: boolean;
  hasRaisedHand?: boolean;
  hasSpeakingPermission?: boolean;
  showFullSize?: boolean;
  replicaText?: string;
  preferredVideoSource?: "camera" | "screen-share";
  onTracksUpdated?: () => void;
}>();

const emit = defineEmits<{ "full-size": [] }>();
</script>
