<template>
  <div class="room-participants-list">
    <Player
      v-for="item in participants"
      :key="`${item.identity}-${item.hasRaisedHand ?? false}`"
      mode="list"
      :participant="item.participant ?? null"
      :participant-name="item.participantName"
      :participant-color="item.participantColor"
      :preview-mode="!item.participant"
      :is-speaking="item.isSpeaking ?? false"
      :is-leader="item.isLeader ?? false"
      :has-raised-hand="item.hasRaisedHand ?? false"
      :has-speaking-permission="item.hasSpeakingPermission ?? false"
      :is-audio-enabled="item.isAudioEnabled"
      :replica-text="item.replicaText"
    >
      <template v-if="$slots.actions" #actions>
        <slot name="actions" :participant="item" />
      </template>
    </Player>
  </div>
</template>

<script setup lang="ts">
import { Player } from "@widgets/video-participant";
import type { RoomParticipantListItem } from "./types";

defineProps<{
  participants: RoomParticipantListItem[];
}>();
</script>

<style scoped>
.room-participants-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
