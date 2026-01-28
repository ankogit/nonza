<template>
  <Player
    mode="grid"
    :participant="participant"
    :participant-name="participantName"
    :is-speaking="isSpeaking"
    :preview-mode="previewMode"
    :is-leader="isLeader"
    :has-raised-hand="hasRaisedHand"
    :has-speaking-permission="hasSpeakingPermission"
    :show-full-size="showFullSize"
    @full-size="emit('full-size')"
  />
</template>

<script setup lang="ts">
import type { RemoteParticipant, LocalParticipant } from "livekit-client";
import Player from "./Player.vue";

defineProps<{
  participant: RemoteParticipant | LocalParticipant | null;
  participantName: string;
  isSpeaking?: boolean;
  previewMode?: boolean;
  isLeader?: boolean;
  hasRaisedHand?: boolean;
  hasSpeakingPermission?: boolean;
  showFullSize?: boolean;
}>();

const emit = defineEmits<{ "full-size": [] }>();
</script>
