<template>
  <div
    ref="wrapElRef"
    class="volume-indicator-wrap"
    :class="{ 'volume-indicator-wrap--open': isVolumeMenuOpen }"
  >
    <div v-if="showVolumeSlider" class="volume-menu">
      <input
        type="range"
        class="volume-slider"
        :min="volumeMin"
        :max="volumeMax"
        step="5"
        :value="volume"
        :title="`${volume}%`"
        @input="onInput"
      />
    </div>
    <button
      type="button"
      class="indicator"
      :class="[
        isAudioEnabled ? 'success' : 'danger',
        { 'indicator--trigger': showTriggerStyle },
      ]"
      :title="title"
      aria-label="Микрофон"
      @click="emit('click', $event)"
    >
      <PixelIcon
        :name="
          listMode
            ? isAudioEnabled
              ? 'volume-high'
              : 'volume-off'
            : 'volume-high'
        "
        variant="small"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { PixelIcon } from "@shared/ui";

const props = withDefaults(
  defineProps<{
    isAudioEnabled: boolean;
    isLocalParticipant: boolean;
    isVolumeMenuOpen: boolean;
    volume: number;
    volumeMin: number;
    volumeMax: number;
    showVolumeSlider: boolean;
    listMode: boolean;
  }>(),
  {},
);

const emit = defineEmits<{
  click: [e: MouseEvent];
  volumeInput: [e: Event];
}>();

const wrapElRef = ref<HTMLElement | null>(null);

defineExpose({
  get wrapEl() {
    return wrapElRef.value;
  },
});

const showTriggerStyle = computed(
  () => !props.listMode || !props.isLocalParticipant,
);

const title = computed(() => {
  if (props.listMode && props.isLocalParticipant) {
    return props.isAudioEnabled ? "Микрофон вкл" : "Микрофон выкл";
  }
  return props.isVolumeMenuOpen ? "Скрыть громкость" : "Громкость";
});

function onInput(e: Event) {
  emit("volumeInput", e);
}
</script>

<style scoped>
.volume-indicator-wrap {
  position: relative;
}

.volume-menu {
  position: absolute;
  right: 0;
  top: 0;
  width: 100px;
  min-width: 100px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2.5px);
  z-index: 21;
  transform: translateX(0px) translateY(0);
  visibility: hidden;
  pointer-events: none;
  opacity: 0;
  transition:
    transform 0.2s ease,
    opacity 0.2s ease,
    visibility 0.2s;
}

.volume-indicator-wrap--open .volume-menu {
  transform: translateX(-24px) translateY(0);
  visibility: visible;
  pointer-events: auto;
  opacity: 1;
}

.indicator {
  z-index: 40;
}

.indicator--trigger.success {
  background: #0ead61;
}

.indicator--trigger.danger {
  background: #e2534b;
}
</style>
