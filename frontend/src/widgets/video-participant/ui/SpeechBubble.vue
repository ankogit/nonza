<template>
  <div class="speech-bubble" :title="text">
    <div class="speech-bubble__part-a" />
    <div class="speech-bubble__part-b" />
    <div class="speech-bubble__part-c" />
    <div class="speech-bubble__txt">
      {{ displayedText
      }}<span v-if="isTyping" class="speech-bubble__cursor">|</span>
    </div>
    <div class="speech-bubble__part-c" />
    <div class="speech-bubble__part-b" />
    <div class="speech-bubble__part-a" />
    <div class="speech-bubble__arrow">
      <div class="speech-bubble__arrow-w" />
      <div class="speech-bubble__arrow-x" />
      <div class="speech-bubble__arrow-y" />
      <div class="speech-bubble__arrow-z" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from "vue";

const props = defineProps<{
  text: string;
}>();

const TYPING_DELAY_MS = 35;

const displayedText = ref("");
const isTyping = ref(false);

let typingTimer: ReturnType<typeof setTimeout> | null = null;

function stopTyping() {
  if (typingTimer !== null) {
    clearTimeout(typingTimer);
    typingTimer = null;
  }
  isTyping.value = false;
}

function runTypingAnimation() {
  stopTyping();
  const full = props.text;
  if (!full) {
    displayedText.value = "";
    return;
  }
  displayedText.value = "";
  isTyping.value = true;

  let index = 0;
  function tick() {
    if (index >= full.length) {
      displayedText.value = full;
      isTyping.value = false;
      typingTimer = null;
      return;
    }
    index += 1;
    displayedText.value = full.slice(0, index);
    typingTimer = setTimeout(tick, TYPING_DELAY_MS);
  }
  typingTimer = setTimeout(tick, TYPING_DELAY_MS);
}

watch(
  () => props.text,
  (newText, oldText) => {
    if (newText !== oldText) runTypingAnimation();
  },
  { immediate: true },
);

onUnmounted(stopTyping);
</script>

<style scoped>
/* Pixel-art speech bubble (layered, dynamic width) */
.speech-bubble,
.speech-bubble__part-a,
.speech-bubble__part-b,
.speech-bubble__part-c,
.speech-bubble__txt,
.speech-bubble__arrow-w,
.speech-bubble__arrow-x,
.speech-bubble__arrow-y,
.speech-bubble__arrow-z {
  box-sizing: border-box;
}

.speech-bubble {
  --bub-border: #222;
  --bub-bg: #fcfcfc;
  --bub-text: #000;
  display: inline-block;
  margin-top: 8px;
  width: fit-content;
  min-width: 120px;
  max-width: min(280px, 100%);
}

.speech-bubble__part-a {
  margin-left: 12px;
  width: calc(100% - 24px);
  height: 4px;
  background: var(--bub-border);
}

.speech-bubble__part-b {
  margin-left: 8px;
  width: calc(100% - 16px);
  height: 4px;
  background: var(--bub-bg);
  border-left: 4px solid var(--bub-border);
  border-right: 4px solid var(--bub-border);
}

.speech-bubble__part-c {
  margin-left: 4px;
  width: calc(100% - 8px);
  height: 4px;
  background: var(--bub-bg);
  border-left: 4px solid var(--bub-border);
  border-right: 4px solid var(--bub-border);
}

.speech-bubble__txt {
  display: block;
  width: max-content;
  min-width: 120px;
  max-width: 100%;
  margin-left: auto;
  margin-right: auto;
  padding: 10px 16px 12px;
  font-family: "Press Start 2P", "Silkscreen", ui-monospace, monospace;
  font-size: 11px;
  line-height: 1.5;
  color: var(--bub-text);
  text-align: center;
  background: var(--bub-bg);
  border-left: 4px solid var(--bub-border);
  border-right: 4px solid var(--bub-border);
  word-break: break-word;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

.speech-bubble__arrow {
  margin-top: -4px;
  margin-left: 24px;
}

.speech-bubble__arrow-w {
  width: 16px;
  height: 4px;
  background: var(--bub-bg);
  border-left: 4px solid var(--bub-border);
  border-right: 4px solid var(--bub-border);
}

.speech-bubble__arrow-x {
  width: 12px;
  height: 4px;
  background: var(--bub-bg);
  border-left: 4px solid var(--bub-border);
  border-right: 4px solid var(--bub-border);
}

.speech-bubble__arrow-y {
  margin-left: -4px;
  width: 12px;
  height: 4px;
  background: var(--bub-bg);
  border-left: 4px solid var(--bub-border);
  border-right: 4px solid var(--bub-border);
}

.speech-bubble__arrow-z {
  margin-left: -4px;
  width: 8px;
  height: 4px;
  background: var(--bub-border);
}

.speech-bubble__cursor {
  animation: speech-bubble-blink 0.6s step-end infinite;
}

@keyframes speech-bubble-blink {
  50% {
    opacity: 0;
  }
}
</style>
