<template>
  <div class="media-check">
    <div class="media-check__preview" :class="{ 'media-check__preview--live': isVideoOn }">
      <video
        ref="videoEl"
        class="media-check__video"
        autoplay
        muted
        playsinline
        :class="{ 'media-check__video--visible': isVideoOn }"
      />
      <span v-if="!isVideoOn" class="media-check__preview-label">видео</span>
    </div>

    <div class="media-check__side">
      <div class="media-check__row">
        <Button
          type="icon"
          size="medium"
          class="media-check__btn"
          :class="{
            'media-check__btn--active': isTestingMic,
            'media-check__btn--off': !isTestingMic,
          }"
          :title="isTestingMic ? 'Остановить тест микрофона' : 'Проверить микрофон'"
          :aria-label="isTestingMic ? 'Остановить тест микрофона' : 'Проверить микрофон'"
          :aria-pressed="isTestingMic"
          @click="toggleMic"
        >
          <PixelIcon
            :name="isTestingMic ? 'mic-on' : 'mic-off'"
            variant="large"
          />
        </Button>
        <div
          class="media-check__level"
          role="meter"
          aria-label="Уровень микрофона"
          :aria-valuemin="0"
          :aria-valuemax="100"
          :aria-valuenow="isTestingMic ? audioLevel : 0"
        >
          <span
            class="media-check__level-fill"
            :style="{ width: `${isTestingMic ? audioLevel : 0}%` }"
          />
        </div>
      </div>

      <div class="media-check__row">
        <Button
          type="icon"
          size="medium"
          class="media-check__btn"
          :class="{
            'media-check__btn--active': isVideoOn,
            'media-check__btn--off': !isVideoOn,
          }"
          :title="isVideoOn ? 'Выключить камеру' : 'Проверить видео'"
          :aria-label="isVideoOn ? 'Выключить камеру' : 'Проверить видео'"
          :aria-pressed="isVideoOn"
          @click="toggleVideo"
        >
          <PixelIcon
            :name="isVideoOn ? 'video-on' : 'video-off'"
            variant="large"
          />
        </Button>
        <span class="media-check__hint">
          {{ mediaHint }}
        </span>
      </div>

      <p v-if="error" class="media-check__error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, nextTick } from "vue";
import {
  useAudioInputTest,
  getStoredAudioInputDevice,
  getStoredVideoInputDevice,
} from "@shared/lib";
import { Button, PixelIcon } from "@shared/ui";

const videoEl = ref<HTMLVideoElement | null>(null);
const isVideoOn = ref(false);
const videoStream = ref<MediaStream | null>(null);
const error = ref<string | null>(null);

const {
  isTesting: isTestingMic,
  audioLevel,
  startTest,
  stopTest,
} = useAudioInputTest();

const mediaHint = computed(() => {
  if (error.value) return "";
  if (isTestingMic.value && isVideoOn.value) return "микрик и камера";
  if (isTestingMic.value) return "говорите в микрик";
  if (isVideoOn.value) return "камера включена";
  return "вебка";
});

async function toggleMic() {
  error.value = null;
  if (isTestingMic.value) {
    stopTest();
    return;
  }
  try {
    await startTest(getStoredAudioInputDevice() || undefined);
  } catch {
    error.value = "Нет доступа к микрофону";
  }
}

function stopVideo() {
  if (videoStream.value) {
    videoStream.value.getTracks().forEach((track) => track.stop());
    videoStream.value = null;
  }
  if (videoEl.value) {
    videoEl.value.srcObject = null;
  }
  isVideoOn.value = false;
}

async function toggleVideo() {
  error.value = null;
  if (isVideoOn.value) {
    stopVideo();
    return;
  }

  try {
    const deviceId = getStoredVideoInputDevice();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: deviceId
        ? { deviceId: { ideal: deviceId }, facingMode: "user" }
        : { facingMode: "user" },
    });
    videoStream.value = stream;
    isVideoOn.value = true;
    await nextTick();
    if (videoEl.value) {
      videoEl.value.srcObject = stream;
      await videoEl.value.play().catch(() => undefined);
    }
  } catch {
    stopVideo();
    error.value = "Нет доступа к камере";
  }
}

defineExpose({
  stopAll: () => {
    stopTest();
    stopVideo();
  },
});

onUnmounted(() => {
  stopTest();
  stopVideo();
});
</script>

<style scoped>
.media-check {
  display: grid;
  grid-template-columns: minmax(96px, 132px) minmax(0, 1fr);
  gap: 12px;
  width: 100%;
  align-items: stretch;
}

.media-check__preview {
  position: relative;
  min-height: 96px;
  aspect-ratio: 4 / 3;
  background: rgba(0, 0, 0, 0.35);
  border: 3px solid rgba(255, 255, 255, 0.14);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-check__preview--live {
  border-color: rgba(255, 255, 255, 0.35);
}

.media-check__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
  opacity: 0;
  pointer-events: none;
}

.media-check__video--visible {
  opacity: 1;
}

.media-check__preview-label {
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 8px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
}

.media-check__side {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  justify-content: center;
}

.media-check__row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.media-check__btn {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
}

.media-check__btn--off {
  background: #3a3a3a !important;
  border-color: #555 !important;
  color: #888 !important;
  opacity: 0.72;
  filter: grayscale(1);
}

.media-check__btn--off:hover {
  background: #454545 !important;
  border-color: #666 !important;
  opacity: 0.9;
}

.media-check__btn--active {
  outline: 2px solid #fff;
  outline-offset: 1px;
  opacity: 1;
  filter: none;
}

.media-check__level {
  flex: 1;
  min-width: 0;
  height: 14px;
  background: rgba(0, 0, 0, 0.35);
  border: 2px solid rgba(255, 255, 255, 0.14);
  overflow: hidden;
}

.media-check__level-fill {
  display: block;
  height: 100%;
  width: 0;
  background: #81b538;
  transition: width 0.08s linear;
}

.media-check__hint {
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 7px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.65);
  line-height: 1.4;
  min-width: 0;
}

.media-check__error {
  margin: 0;
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 7px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #e2534b;
  line-height: 1.4;
}

@media (max-width: 720px) {
  .media-check {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    gap: 10px;
    align-items: stretch;
  }

  .media-check__preview {
    width: 100%;
    max-width: 160px;
    min-height: 0;
    aspect-ratio: 4 / 3;
    justify-self: start;
  }

  .media-check__side {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    justify-content: flex-start;
  }

  .media-check__row {
    flex: 1 1 auto;
    min-width: min(100%, 140px);
    gap: 8px;
  }

  .media-check__btn {
    width: 40px;
    height: 40px;
  }

  .media-check__level {
    height: 12px;
    max-width: 120px;
  }

  .media-check__hint {
    font-size: 6px;
  }

  .media-check__error {
    flex: 1 1 100%;
  }
}
</style>
