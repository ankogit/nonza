<template>
  <div v-memo="[text]" class="player-replica-wrap">
    <SpeechBubble :text="text" />
  </div>
</template>

<script setup lang="ts">
import SpeechBubble from "./SpeechBubble.vue";

defineProps<{
  text: string;
}>();
</script>

<style scoped>
.player-replica-wrap {
  min-width: 0;
  position: absolute;
  align-self: flex-start;
  left: 0;
  bottom: 32px;
  max-width: min(280px, 100%);
}
</style>
