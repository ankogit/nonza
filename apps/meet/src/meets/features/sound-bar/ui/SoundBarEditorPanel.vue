<template>
  <div class="soundbar-editor-panel">
    <div class="soundbar-editor-panel__wave-row">
      <div class="soundbar-editor-panel__side-knob">
        <Knob
          v-model="volume"
          label="Volume"
          color="orange"
          :min="0"
          :max="100"
          :step="1"
          :size="64"
          :format-value="(v: number) => `${Math.round(v)}%`"
        />
      </div>

      <div class="soundbar-editor-panel__wave-area">
        <div v-if="!selectedFile" class="soundbar-editor-panel__empty-wave">
          <label class="soundbar-editor-panel__pick">
            <span class="soundbar-editor-panel__pick-text"
              >Выберите аудиофайл</span
            >
            <input
              ref="fileInputRef"
              class="soundbar-editor-panel__pick-input"
              type="file"
              accept="audio/*"
              :disabled="isSaving"
              @change="handleFile"
            />
          </label>
        </div>

        <template v-else>
          <div class="sound-bar-editor__wave-wrap">
            <div class="sound-bar-editor__wave" ref="waveContainer">
              <div
                class="sound-bar-editor__wave-hover"
                ref="waveHoverEl"
                aria-hidden="true"
              />
              <div
                class="sound-bar-editor__wave-time sound-bar-editor__wave-time--left"
                ref="waveTimeEl"
              >
                0:00
              </div>
              <div
                class="sound-bar-editor__wave-time sound-bar-editor__wave-time--right"
                ref="waveDurationEl"
              >
                0:00
              </div>
            </div>

            <div v-if="decodeError" class="sound-bar-editor__error">
              Не удалось отобразить waveform для этого файла. Попробуйте другой
              формат.
            </div>
          </div>
        </template>
      </div>

      <div class="soundbar-editor-panel__side-knob">
        <Knob
          v-model="speed"
          label="Speed"
          color="blue"
          :min="50"
          :max="150"
          :step="1"
          :size="64"
          :format-value="(v: number) => `${(v / 100).toFixed(2)}x`"
        />
      </div>
    </div>

    <div v-if="selectedFile" class="soundbar-editor-panel__controls">
      <div class="sound-bar-editor__time soundbar-editor-panel__times">
        <div class="sound-bar-editor__time-row">
          <span class="sound-bar-editor__time-label">Start</span>
          <span class="sound-bar-editor__time-value">{{
            Math.round(startMsSource)
          }}</span>
          <span class="sound-bar-editor__time-unit">ms</span>
        </div>
        <div class="sound-bar-editor__time-row">
          <span class="sound-bar-editor__time-label">End</span>
          <span class="sound-bar-editor__time-value">{{
            Math.round(endMsSource)
          }}</span>
          <span class="sound-bar-editor__time-unit">ms</span>
        </div>
      </div>
      <div class="soundbar-editor-panel__center">
        <Button
          type="icon"
          variant="danger"
          size="tiny"
          :disabled="isSaving"
          aria-label="Сбросить файл"
          title="Сбросить файл"
          @click="resetAudioFile"
        >
          <PixelIcon name="delete" variant="small" />
        </Button>
        <Switch v-model="loopEnabled" :disabled="isSaving" aria-label="Loop">
          Loop
        </Switch>
        <Switch v-model="gateEnabled" :disabled="isSaving" aria-label="Gate">
          Gate
        </Switch>
        <Button
          v-if="gateEnabled"
          variant="primary"
          size="tiny"
          :disabled="!selectedRegion || !!decodeError || isSaving"
          @pointerdown.prevent="onSegmentPlayPointerDown"
          @pointerup="onSegmentPlayPointerUp"
          @pointerleave="onSegmentPlayPointerUp"
          @pointercancel="onSegmentPlayPointerUp"
        >
          <PixelIcon name="play-hold" variant="small" />
        </Button>
        <Button
          v-else
          variant="primary"
          size="tiny"
          :disabled="!selectedRegion || !!decodeError || isSaving"
          @click="onSegmentPlayClick"
        >
          <PixelIcon
            :name="loopEnabled && isPreviewPlaying ? 'stop' : 'play'"
            variant="small"
          />
        </Button>
      </div>
    </div>

    <section class="soundbar-editor-panel__meta">
      <p v-if="saveHint" class="soundbar-editor-panel__meta-hint">
        {{ saveHint }}
      </p>
      <div class="soundbar-editor-panel__meta-row">
        <div ref="emojiPickerWrapRef" class="soundbar-editor-panel__emoji-slot">
          <Button
            type="icon"
            variant="default"
            size="small"
            :disabled="!audioReady || isSaving"
            :aria-expanded="emojiPickerOpen"
            aria-haspopup="dialog"
            aria-label="Эмодзи слота"
            @click="toggleEmojiPicker"
          >
            <span
              class="soundbar-editor-panel__emoji-preview"
              aria-live="polite"
              >{{ emoji || "—" }}</span
            >
          </Button>
          <div
            v-if="emojiPickerOpen && audioReady"
            class="soundbar-editor-panel__emoji-popover"
            role="dialog"
            aria-label="Выбор эмодзи"
            @click.stop
          >
            <EmojiPicker
              class="sound-bar-editor__emoji-picker"
              :native="true"
              theme="dark"
              :hide-search="true"
              :static-texts="{ placeholder: 'Поиск…', skinTone: 'Тон кожи' }"
              @select="onEmojiSelect"
            />
          </div>
        </div>
        <div class="soundbar-editor-panel__meta-title-wrap">
          <Input
            v-model="title"
            size="small"
            placeholder="Название (необязательно)"
            aria-label="Название звука"
            :disabled="!audioReady || isSaving"
          />
        </div>
        <Button
          variant="primary"
          size="small"
          type="text"
          class="soundbar-editor-panel__meta-save"
          :disabled="!canSave"
          @click="handleSave"
        >
          Сохранить
        </Button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import type { Region } from "wavesurfer.js/dist/plugins/regions";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions";

import EmojiPicker from "vue3-emoji-picker";
import type { EmojiExt } from "vue3-emoji-picker";
import "vue3-emoji-picker/css";

import { Button, Input, Switch, Knob, PixelIcon } from "@shared/ui";
import {
  getAuthHeaders,
  renderSoundBarClipForUpload,
  showToast,
  useAppConfig,
} from "@shared/lib";

type SavePayload = {
  emoji: string;
  title?: string;
  startMs: number;
  endMs: number;
  audio: File;
};

const props = defineProps<{
  orgId: string | null;
  sessionKey: number;
  initialEmoji?: string | null;
  initialTitle?: string | null;
  initialLoopEnabled?: boolean | null;
  initialGateEnabled?: boolean | null;
  initialVolume?: number | null;
  initialSpeed?: number | null;
  /** При редактировании — URL сохранённого файла (подгружается в волну). */
  initialAudioUrl?: string | null;
}>();

const emit = defineEmits<{
  saved: [];
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);
const emojiPickerWrapRef = ref<HTMLElement | null>(null);
const emojiPickerOpen = ref(false);

const emoji = ref(props.initialEmoji ?? "");
const title = ref("");
const selectedFile = ref<File | null>(null);
const selectedRegion = ref<Region | null>(null);
const decodeError = ref(false);
const isSaving = ref(false);
const waveContainer = ref<HTMLDivElement | null>(null);
const waveHoverEl = ref<HTMLDivElement | null>(null);
const waveTimeEl = ref<HTMLDivElement | null>(null);
const waveDurationEl = ref<HTMLDivElement | null>(null);
const loopEnabled = ref(false);
const gateEnabled = ref(false);
const volume = ref(100);
const speed = ref(100);
const isPreviewPlaying = ref(false);
const previewLoopSegment = ref(false);
const gateSpaceHeld = ref(false);
const selectEntireWaveOnReady = ref(false);

type WaveSurferInstance = InstanceType<typeof WaveSurfer>;
type RegionsPluginInstance = InstanceType<typeof RegionsPlugin>;
const wavesurfer = ref<WaveSurferInstance | null>(null);
let regionsPlugin: RegionsPluginInstance | null = null;
let disableDragSelection: (() => void) | null = null;
let onWavePointerMove: ((e: PointerEvent) => void) | null = null;
let onWavePointerLeave: (() => void) | null = null;
let onKeyDown: ((e: KeyboardEvent) => void) | null = null;
let onKeyUp: ((e: KeyboardEvent) => void) | null = null;
let offPreviewEndCheck: (() => void) | null = null;

const waveDurationSeconds = ref(0);

function formatWaveTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secondsRemainder = Math.max(0, Math.round(seconds) % 60);
  return `${minutes}:${String(secondsRemainder).padStart(2, "0")}`;
}

function getSpeedRate(): number {
  return Math.max(0.25, Math.min(speed.value / 100, 4));
}

function toEffectiveSeconds(sourceSeconds: number): number {
  return sourceSeconds / getSpeedRate();
}

function updateWaveTimeLabels(currentSourceTime = 0): void {
  if (waveDurationEl.value) {
    waveDurationEl.value.textContent = formatWaveTime(
      toEffectiveSeconds(waveDurationSeconds.value),
    );
  }
  if (waveTimeEl.value) {
    waveTimeEl.value.textContent = formatWaveTime(
      toEffectiveSeconds(currentSourceTime),
    );
  }
}

function applyWaveSpeed(speedPercent: number): void {
  if (!wavesurfer.value) return;
  const nextRate = Math.max(0.25, Math.min(speedPercent / 100, 4));
  const duration = waveDurationSeconds.value;
  const selectedSegment = selectedRegion.value
    ? { start: selectedRegion.value.start, end: selectedRegion.value.end }
    : null;
  wavesurfer.value.setPlaybackRate(nextRate);

  const containerWidth = waveContainer.value?.clientWidth ?? 0;
  if (duration <= 0 || containerWidth <= 0) return;

  const baseMinPxPerSec = containerWidth / duration;
  const minPxPerSec = Math.max(1, baseMinPxPerSec / nextRate);
  wavesurfer.value.setOptions({ minPxPerSec });

  if (selectedRegion.value && selectedSegment) {
    selectedRegion.value.setOptions({
      start: selectedSegment.start,
      end: selectedSegment.end,
    });
  }
  const currentSourceTime = wavesurfer.value.getCurrentTime();
  updateWaveTimeLabels(currentSourceTime);
}

function clampVolume(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function clearPreviewEndListener(): void {
  offPreviewEndCheck?.();
  offPreviewEndCheck = null;
}

function destroyWaveSurfer() {
  stopPreview();
  disableDragSelection?.();
  disableDragSelection = null;
  regionsPlugin = null;

  if (waveContainer.value && onWavePointerMove) {
    waveContainer.value.removeEventListener("pointermove", onWavePointerMove);
  }
  if (waveContainer.value && onWavePointerLeave) {
    waveContainer.value.removeEventListener("pointerleave", onWavePointerLeave);
  }
  onWavePointerMove = null;
  onWavePointerLeave = null;

  if (waveHoverEl.value) {
    waveHoverEl.value.style.width = "0px";
  }
  if (waveTimeEl.value) waveTimeEl.value.textContent = "0:00";
  if (waveDurationEl.value) waveDurationEl.value.textContent = "0:00";
  waveDurationSeconds.value = 0;

  if (onKeyDown) {
    window.removeEventListener("keydown", onKeyDown);
    onKeyDown = null;
  }
  if (onKeyUp) {
    window.removeEventListener("keyup", onKeyUp);
    onKeyUp = null;
  }
  gateSpaceHeld.value = false;

  if (wavesurfer.value) {
    wavesurfer.value.destroy();
    wavesurfer.value = null;
  }
  selectedRegion.value = null;
  decodeError.value = false;
}

function clampEmoji(raw: string): string {
  return raw.trim().slice(0, 8);
}

function onEmojiSelect(e: EmojiExt): void {
  emoji.value = clampEmoji(e.i);
  emojiPickerOpen.value = false;
}

function toggleEmojiPicker() {
  if (!audioReady.value || isSaving.value) return;
  emojiPickerOpen.value = !emojiPickerOpen.value;
}

function onDocPointerDown(e: PointerEvent) {
  const root = emojiPickerWrapRef.value;
  if (!root || !emojiPickerOpen.value) return;
  if (root.contains(e.target as Node)) return;
  emojiPickerOpen.value = false;
}

function resetAudioFile(): void {
  destroyWaveSurfer();
  selectedFile.value = null;
  selectEntireWaveOnReady.value = false;
  if (fileInputRef.value) {
    fileInputRef.value.value = "";
  }
}

function applySessionDefaults(): void {
  emoji.value = clampEmoji(props.initialEmoji ?? "");
  title.value = (props.initialTitle ?? "").trim();
  loopEnabled.value = Boolean(props.initialLoopEnabled ?? false);
  gateEnabled.value = Boolean(props.initialGateEnabled ?? false);
  volume.value = clampVolume(Number(props.initialVolume ?? 100));
  speed.value = Number(props.initialSpeed ?? 100);
}

function resolveAudioUrl(url: string): string {
  const t = url.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("//")) return `${window.location.protocol}${t}`;
  return new URL(t, window.location.origin).href;
}

async function loadInitialAudioFromUrl(rawUrl: string): Promise<void> {
  const url = resolveAudioUrl(rawUrl);
  decodeError.value = false;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const segment = url.split("/").pop()?.split("?")[0] || "sound.ogg";
    const safeName = /\.(ogg|opus|mp3|wav|m4a)$/i.test(segment)
      ? segment
      : `${segment}.ogg`;
    const file = new File([blob], safeName, {
      type: blob.type || "audio/ogg",
    });
    selectedFile.value = file;
    selectEntireWaveOnReady.value = true;
    await loadWaveFromFile(file);
  } catch {
    selectedFile.value = null;
    selectEntireWaveOnReady.value = false;
    decodeError.value = true;
    showToast("Не удалось загрузить звук для редактирования", {
      variant: "warning",
    });
  }
}

watch(
  () => props.sessionKey,
  async () => {
    destroyWaveSurfer();
    selectedFile.value = null;
    selectEntireWaveOnReady.value = false;
    if (fileInputRef.value) {
      fileInputRef.value.value = "";
    }
    decodeError.value = false;
    emojiPickerOpen.value = false;
    applySessionDefaults();
    if (props.initialAudioUrl?.trim()) {
      speed.value = 100;
      volume.value = 100;
    }
    await nextTick();
    if (!onKeyDown) {
      onKeyDown = (e: KeyboardEvent) => {
        if (!props.orgId) return;
        if (e.code !== "Space") return;
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
        e.preventDefault();
        if (e.repeat) return;
        if (gateEnabled.value) {
          gateSpaceHeld.value = true;
          onSegmentPlayPointerDown();
          return;
        }
        if (loopEnabled.value) {
          void onSegmentLoopToggle();
          return;
        }
        void startSegmentPlayback(false);
      };
      window.addEventListener("keydown", onKeyDown);
    }
    if (!onKeyUp) {
      onKeyUp = (e: KeyboardEvent) => {
        if (!props.orgId) return;
        if (e.code !== "Space") return;
        if (gateEnabled.value && gateSpaceHeld.value) {
          gateSpaceHeld.value = false;
          onSegmentPlayPointerUp();
        }
      };
      window.addEventListener("keyup", onKeyUp);
    }
    const initial = props.initialAudioUrl?.trim();
    if (initial) {
      await loadInitialAudioFromUrl(initial);
    }
  },
  { immediate: true },
);

watch(volume, () => {
  if (!wavesurfer.value) return;
  wavesurfer.value.setVolume(Math.max(0, Math.min(volume.value / 100, 1)));
});

const startMsSource = computed(() => {
  if (!selectedRegion.value) return 0;
  return selectedRegion.value.start * 1000;
});

const endMsSource = computed(() => {
  if (!selectedRegion.value) return 0;
  return selectedRegion.value.end * 1000;
});

const audioReady = computed(() => {
  if (!props.orgId) return false;
  if (decodeError.value) return false;
  if (isSaving.value) return false;
  if (!selectedFile.value) return false;
  if (!selectedRegion.value) return false;
  return selectedRegion.value.end > selectedRegion.value.start;
});

const saveHint = computed(() => {
  if (!props.orgId) return "";
  if (!selectedFile.value) return "Сначала выберите аудиофайл.";
  if (decodeError.value)
    return "Этот файл не удалось разобрать — попробуйте другой.";
  if (
    !selectedRegion.value ||
    selectedRegion.value.end <= selectedRegion.value.start
  ) {
    return "Выделите фрагмент на волне.";
  }
  if (!emoji.value.trim()) return "Выберите эмодзи для слота.";
  return "";
});

const canSave = computed(() => {
  if (!audioReady.value) return false;
  if (!emoji.value.trim()) return false;
  return true;
});

watch(audioReady, (v) => {
  if (!v) emojiPickerOpen.value = false;
});

onMounted(() => {
  document.addEventListener("pointerdown", onDocPointerDown);
});

onUnmounted(() => {
  document.removeEventListener("pointerdown", onDocPointerDown);
  destroyWaveSurfer();
});

function handleFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (!file) return;

  destroyWaveSurfer();
  selectedFile.value = file;
  selectEntireWaveOnReady.value = true;

  void loadWaveFromFile(file);
}

async function loadWaveFromFile(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const url = objectUrl;

  decodeError.value = false;

  await nextTick();

  const container = waveContainer.value;
  if (!container) {
    URL.revokeObjectURL(objectUrl);
    return;
  }
  const height = 80;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  const waveGradient = ctx
    ? (() => {
        const g = ctx.createLinearGradient(0, 0, 0, canvas.height * 1.35);
        g.addColorStop(0, "#656666");
        g.addColorStop((canvas.height * 0.7) / canvas.height, "#656666");
        g.addColorStop((canvas.height * 0.7 + 1) / canvas.height, "#ffffff");
        g.addColorStop((canvas.height * 0.7 + 2) / canvas.height, "#ffffff");
        g.addColorStop((canvas.height * 0.7 + 3) / canvas.height, "#B1B1B1");
        g.addColorStop(1, "#B1B1B1");
        return g;
      })()
    : "#444";

  const progressGradient = ctx
    ? (() => {
        const g = ctx.createLinearGradient(0, 0, 0, canvas.height * 1.35);
        g.addColorStop(0, "#2980b9");
        g.addColorStop((canvas.height * 0.7) / canvas.height, "#3a91c9");
        g.addColorStop((canvas.height * 0.7 + 1) / canvas.height, "#ffffff");
        g.addColorStop((canvas.height * 0.7 + 2) / canvas.height, "#ffffff");
        g.addColorStop((canvas.height * 0.7 + 3) / canvas.height, "#bab1a8");
        g.addColorStop(1, "#bab1a8");
        return g;
      })()
    : "#bab1a8";

  const instance = WaveSurfer.create({
    container,
    height,
    waveColor: waveGradient as any,
    progressColor: progressGradient as any,
    barWidth: 2,
    cursorColor: "#bab1a8",
    interact: true,
    plugins: [RegionsPlugin.create()],
    backend: "WebAudio",
  }) as WaveSurferInstance;

  instance.on("error", () => {
    decodeError.value = true;
  });

  instance.on("ready", () => {
    const plugins = instance.getActivePlugins() as unknown[];
    const found = plugins.find((p) => p instanceof RegionsPlugin) as
      | RegionsPluginInstance
      | undefined;
    if (!found) return;
    regionsPlugin = found;

    const disable = regionsPlugin.enableDragSelection(
      {
        drag: true,
        resize: true,
        color: "rgba(69, 191, 255, 0.25)",
        minLength: 0.05,
      },
      3,
    );
    disableDragSelection = disable;

    regionsPlugin.clearRegions();

    regionsPlugin.on("region-created", (region: Region) => {
      const all = regionsPlugin?.getRegions() ?? [];
      for (const r of all) {
        if (r !== region) r.remove();
      }
      selectedRegion.value = region;
    });

    regionsPlugin.on("region-updated", (region: Region) => {
      selectedRegion.value = region;
    });
  });

  instance.on("decode", (duration) => {
    waveDurationSeconds.value = duration;
    applyWaveSpeed(speed.value);
    updateWaveTimeLabels(0);
    if (!selectEntireWaveOnReady.value || duration <= 0) return;
    const addFullRegion = () => {
      if (!selectEntireWaveOnReady.value || !regionsPlugin) return;
      selectEntireWaveOnReady.value = false;
      regionsPlugin.clearRegions();
      const r = regionsPlugin.addRegion({
        start: 0,
        end: Math.max(duration, 0.05),
        drag: true,
        resize: true,
        color: "rgba(69, 191, 255, 0.25)",
        minLength: 0.05,
      });
      selectedRegion.value = r;
    };
    if (regionsPlugin) addFullRegion();
    else setTimeout(addFullRegion, 0);
  });

  instance.on("timeupdate", (currentTime) => {
    updateWaveTimeLabels(currentTime);
  });
  instance.on("finish", () => {
    stopPreview();
  });

  onWavePointerMove = (e: PointerEvent) => {
    if (!waveHoverEl.value) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clamped = Math.max(0, Math.min(x, rect.width));
    waveHoverEl.value.style.width = `${clamped}px`;
  };

  onWavePointerLeave = () => {
    if (!waveHoverEl.value) return;
    waveHoverEl.value.style.width = "0px";
  };

  container.addEventListener("pointermove", onWavePointerMove);
  container.addEventListener("pointerleave", onWavePointerLeave);

  wavesurfer.value = instance;

  try {
    await instance.load(url);
  } catch {
    decodeError.value = true;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function stopPreview() {
  clearPreviewEndListener();
  if (wavesurfer.value) {
    wavesurfer.value.stop();
  }
  isPreviewPlaying.value = false;
  previewLoopSegment.value = false;
}

function attachSegmentEndListener(
  start: number,
  end: number,
  loopSegment: boolean,
): void {
  clearPreviewEndListener();
  if (!wavesurfer.value) return;
  offPreviewEndCheck = wavesurfer.value.on("audioprocess", (t: number) => {
    if (t < end) return;
    if (loopSegment && wavesurfer.value) {
      wavesurfer.value.setTime(start);
      return;
    }
    stopPreview();
  });
}

async function startSegmentPlayback(loopSegment: boolean) {
  if (!selectedRegion.value) return;
  if (!wavesurfer.value) return;
  stopPreview();
  previewLoopSegment.value = loopSegment;
  applyWaveSpeed(speed.value);
  wavesurfer.value.setVolume(Math.max(0, Math.min(volume.value / 100, 1)));
  const start = Math.max(0, selectedRegion.value.start);
  const end = Math.max(start, selectedRegion.value.end);
  isPreviewPlaying.value = true;
  attachSegmentEndListener(start, end, loopSegment);
  try {
    await wavesurfer.value.play(start);
  } catch {
    stopPreview();
  }
}

async function onSegmentLoopToggle() {
  if (!selectedRegion.value || decodeError.value || isSaving.value) return;
  if (isPreviewPlaying.value) {
    stopPreview();
    return;
  }
  await startSegmentPlayback(true);
}

function onSegmentPlayPointerDown() {
  if (!selectedRegion.value || decodeError.value || isSaving.value) return;
  void startSegmentPlayback(loopEnabled.value);
}

function onSegmentPlayPointerUp() {
  stopPreview();
}

function onSegmentPlayClick() {
  if (!selectedRegion.value || decodeError.value || isSaving.value) return;
  if (loopEnabled.value) {
    void onSegmentLoopToggle();
    return;
  }
  void startSegmentPlayback(false);
}

watch(speed, () => {
  applyWaveSpeed(speed.value);
  if (isPreviewPlaying.value) {
    void startSegmentPlayback(previewLoopSegment.value);
  }
});

async function handleSave() {
  if (!canSave.value) return;
  const orgId = props.orgId;
  if (!orgId || !selectedFile.value || !selectedRegion.value) return;

  let processedAudio: File;
  try {
    processedAudio = await renderSoundBarClipForUpload({
      file: selectedFile.value,
      startSec: selectedRegion.value.start,
      endSec: selectedRegion.value.end,
      volume: clampVolume(volume.value),
      speed: Math.round(speed.value),
    });
  } catch (e) {
    showToast(
      e instanceof Error ? e.message : "Не удалось обработать аудио",
      { variant: "danger" },
    );
    return;
  }

  const payload: SavePayload = {
    emoji: clampEmoji(emoji.value),
    title: title.value.trim() || undefined,
    startMs: startMsSource.value,
    endMs: endMsSource.value,
    audio: processedAudio,
  };

  const { apiBaseURL } = useAppConfig();
  const endpoint = `/api/v1/org/${encodeURIComponent(orgId)}/sounds`;
  const headers = getAuthHeaders();

  const form = new FormData();
  form.append("emoji", payload.emoji);
  if (payload.title) form.append("title", payload.title);
  form.append("startMs", String(Math.round(payload.startMs)));
  form.append("endMs", String(Math.round(payload.endMs)));
  form.append("audio", payload.audio);
  form.append("clientProcessed", "1");
  form.append("loopEnabled", String(loopEnabled.value));
  form.append("gateEnabled", String(gateEnabled.value));
  form.append("volume", String(clampVolume(volume.value)));
  form.append("speed", String(Math.round(speed.value)));

  isSaving.value = true;
  try {
    const res = await fetch(`${apiBaseURL}${endpoint}`, {
      method: "POST",
      headers,
      body: form,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `HTTP ${res.status}`);
    }

    emit("saved");
    showToast("Звук сохранен", { variant: "success" });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Не удалось сохранить звук";
    showToast(msg, { variant: "danger" });
  } finally {
    isSaving.value = false;
  }
}
</script>

<style scoped>
.soundbar-editor-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.soundbar-editor-panel__wave-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: stretch;
}

.soundbar-editor-panel__side-knob {
  display: flex;
  align-items: center;
  justify-content: center;
}

.soundbar-editor-panel__wave-area {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.soundbar-editor-panel__empty-wave {
  position: relative;
  min-height: 102px;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  background: #151515;
  border: 3px dashed #333;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.35);
}

.soundbar-editor-panel__pick {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 80px;
  cursor: pointer;
  color: #bab1a8;
  font-size: 14px;
}

.soundbar-editor-panel__pick-text {
  pointer-events: none;
}

.soundbar-editor-panel__pick-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.soundbar-editor-panel__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px 12px;
}

.soundbar-editor-panel__times {
  flex: 0 1 auto;
  min-width: 0;
  margin-right: auto;
}

.soundbar-editor-panel__center {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  justify-content: center;
  flex: 1 1 auto;
  min-width: 0;
}

.soundbar-editor-panel__meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.soundbar-editor-panel__meta-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.35;
  color: #888;
}

.soundbar-editor-panel__meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.soundbar-editor-panel__emoji-slot {
  position: relative;
  flex-shrink: 0;
}

.soundbar-editor-panel__emoji-slot
  :deep(.soundbar-editor-panel__emoji-trigger) {
  box-sizing: border-box;
  width: 40px;
  min-width: 40px;
  height: 36px;
  min-height: 36px;
  padding: 0;
  border-color: #ffffff10;
  border-top-color: #ffffff20;
  border-left-color: #ffffff20;
  background: #252525;
  filter: none;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.25);
}

.soundbar-editor-panel__emoji-slot
  :deep(.soundbar-editor-panel__emoji-trigger:hover:not(.button--disabled)) {
  background: #2e2e2e;
  scale: 1;
}

.soundbar-editor-panel__emoji-slot
  :deep(.soundbar-editor-panel__emoji-trigger.button--disabled) {
  opacity: 0.45;
  cursor: not-allowed;
}

.soundbar-editor-panel__emoji-preview {
  font-size: 22px;
  line-height: 1;
  word-break: break-all;
}

.soundbar-editor-panel__emoji-popover {
  position: absolute;
  left: 0;
  top: calc(100% + 4px);
  z-index: 30;
  width: min(92vw, 320px);
  max-height: min(52vh, 280px);
  overflow: auto;
  border: 3px solid #333;
  background: #000;
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.45);
}

.soundbar-editor-panel__meta-title-wrap {
  flex: 1;
  min-width: 140px;
  display: flex;
  align-items: stretch;
}

.soundbar-editor-panel__meta-title-wrap :deep(.pixel-input) {
  height: 36px;
  min-height: 36px;
}

.soundbar-editor-panel__meta-save.button--text {
  flex-shrink: 0;
  box-sizing: border-box;
  height: 36px;
  min-height: 36px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.sound-bar-editor__emoji-picker :deep(.v3-emoji-picker) {
  width: 100%;
  max-width: 100%;
  height: auto;
  max-height: min(50vh, 260px);
  margin: 0;
  border-radius: 0;
  box-shadow: none;
}

.sound-bar-editor__wave-wrap {
  position: relative;
  background: #151515;
  border: 3px solid #333;
  border-top-color: #444;
  border-left-color: #444;
  padding: 8px;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.35);
}

.sound-bar-editor__wave {
  width: 100%;
  position: relative;
  cursor: pointer;
  overflow: hidden;
}

.sound-bar-editor__wave-hover {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 0;
  background: rgba(41, 128, 185, 0.35);
  mix-blend-mode: overlay;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.sound-bar-editor__wave:hover .sound-bar-editor__wave-hover {
  opacity: 1;
}

.sound-bar-editor__wave-time {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 11;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.75);
  padding: 2px 4px;
  color: #ddd;
  border-radius: 0;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.35);
}

.sound-bar-editor__wave-time--left {
  left: 0;
}

.sound-bar-editor__wave-time--right {
  right: 0;
}

.sound-bar-editor__error {
  margin-top: 12px;
  color: #e2534b;
}

.sound-bar-editor__time {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.2;
}

.sound-bar-editor__time-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.sound-bar-editor__time-label {
  flex: 0 0 auto;
  color: #888;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.sound-bar-editor__time-unit {
  flex: 0 0 auto;
  color: #666;
  font-size: 10px;
}

.sound-bar-editor__time-value {
  flex: 0 1 auto;
  min-width: 0;
  color: #ddd;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
</style>
