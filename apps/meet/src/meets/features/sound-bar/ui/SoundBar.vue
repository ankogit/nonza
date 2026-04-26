<template>
  <div
    v-if="!previewMode"
    ref="rootRef"
    class="sound-bar"
    :class="{ 'sound-bar--panel-root': isPanel }"
  >
    <div
      v-if="hasOrg"
      class="sound-bar__host"
      :class="{ 'sound-bar__host--panel': isPanel }"
    >
      <Button
        v-if="!isPanel"
        type="icon"
        size="large"
        variant="default"
        :class="{ active: popoverOpen }"
        title="Звуки организации"
        @click.stop="togglePopover"
      >
        <PixelIcon name="notes" variant="large" />
      </Button>

      <div
        v-show="isPanel || popoverOpen"
        class="sound-bar__surface"
        :class="{
          'sound-bar__surface--popover': !isPanel,
          'sound-bar__surface--panel': isPanel,
        }"
        :role="isPanel ? 'region' : 'dialog'"
        aria-label="Звуки"
        @click.stop
      >
        <div
          v-if="soundBarSurfaceBlocked"
          class="sound-bar__decode-blocker"
          role="status"
          aria-busy="true"
          aria-label="Загрузка звуков"
        >
          <PixelIcon name="loading" variant="large" />
        </div>
        <div class="sound-bar__volume">
          <button
            class="sound-bar__mute-btn"
            :title="soundBarMutedRef ? 'Включить звуки' : 'Выключить звуки'"
            @click.stop="toggleSoundBarMuted"
          >
            <PixelIcon
              :name="soundBarMutedRef ? 'volume-off' : 'volume-high'"
              variant="small"
            />
          </button>
          <input
            type="range"
            class="volume-slider"
            min="0"
            max="100"
            step="5"
            :value="Math.round(soundBarVolumeRef * 100)"
            :title="`Громкость: ${Math.round(soundBarVolumeRef * 100)}%`"
            @input="onVolumeInput"
          />
        </div>
        <div class="sound-bar__playback">
          <div
            class="sound-bar__playback-tabs"
            role="tablist"
            aria-label="Sound settings tabs"
          >
            <button
              type="button"
              role="tab"
              class="sound-bar__playback-tab"
              :class="{
                'sound-bar__playback-tab--active':
                  activeEditorTab === 'playback',
              }"
              :aria-selected="activeEditorTab === 'playback'"
              @click="activeEditorTab = 'playback'"
            >
              Playback
            </button>
            <button
              type="button"
              role="tab"
              class="sound-bar__playback-tab"
              :class="{
                'sound-bar__playback-tab--active': activeEditorTab === 'fx',
              }"
              :aria-selected="activeEditorTab === 'fx'"
              @click="activeEditorTab = 'fx'"
            >
              FX
            </button>
            <button
              type="button"
              role="tab"
              class="sound-bar__playback-tab"
              :class="{
                'sound-bar__playback-tab--active': activeEditorTab === 'eq',
              }"
              :aria-selected="activeEditorTab === 'eq'"
              @click="activeEditorTab = 'eq'"
            >
              EQ
            </button>
            <button
              type="button"
              role="tab"
              class="sound-bar__playback-tab"
              :class="{
                'sound-bar__playback-tab--active':
                  activeEditorTab === 'compressor',
              }"
              :aria-selected="activeEditorTab === 'compressor'"
              @click="activeEditorTab = 'compressor'"
            >
              Comp
            </button>
            <button
              v-if="hasOrg"
              type="button"
              role="tab"
              class="sound-bar__playback-tab sound-bar__playback-tab--upload"
              :class="{
                'sound-bar__playback-tab--active':
                  activeEditorTab === 'upload',
              }"
              :aria-selected="activeEditorTab === 'upload'"
              @click="activeEditorTab = 'upload'"
            >
              Upload
            </button>
          </div>
          <div
            v-if="activeEditorTab === 'playback'"
            class="sound-bar__playback-main"
          >
            <div class="sound-bar__toggles">
              <Switch
                :model-value="panelLoop"
                aria-label="Loop"
                @update:model-value="setPanelLoop"
              >
                Loop
              </Switch>
              <Switch
                :model-value="panelGate"
                aria-label="Gate"
                @update:model-value="setPanelGate"
              >
                Gate
              </Switch>
              <Switch
                :model-value="panelReverse"
                :disabled="panelPendulum && !panelGate"
                aria-label="Реверс"
                @update:model-value="setPanelReverse"
              >
                Реверс
              </Switch>
              <Switch
                :model-value="panelPendulum"
                aria-label="Ping-pong"
                @update:model-value="setPanelPendulum"
              >
                Ping-pong
              </Switch>
            </div>
            <div class="sound-bar__knobs-row">
              <Knob
                :model-value="clipVolumePct"
                :min="0"
                :max="500"
                :step="5"
                compact
                label="Громк."
                color="blue"
                :format-value="formatClipVolume"
                @update:model-value="clipVolumePct = $event"
              />
              <Knob
                :model-value="clipSpeedPct"
                :min="25"
                :max="400"
                :step="5"
                compact
                label="Скорость"
                color="orange"
                :format-value="formatClipSpeed"
                @update:model-value="clipSpeedPct = $event"
              />
              <Knob
                :model-value="clipPitchPct"
                :min="25"
                :max="400"
                :step="5"
                compact
                label="Питч"
                color="red"
                :format-value="formatClipPitch"
                @update:model-value="clipPitchPct = $event"
              />
            </div>
          </div>
          <div
            v-else-if="activeEditorTab === 'fx'"
            class="sound-bar__playback-main sound-bar__playback-main--fx"
          >
            <div class="sound-bar__knobs-row sound-bar__knobs-row--fx">
              <Knob
                :model-value="fxFilterHz"
                :min="200"
                :max="20000"
                :step="100"
                compact
                label="LPF"
                color="orange"
                :format-value="formatFilterHz"
                @update:model-value="fxFilterHz = $event"
              />
              <Knob
                :model-value="fxDistortion"
                :min="0"
                :max="100"
                :step="1"
                compact
                label="Drive"
                color="red"
                :format-value="formatPercent"
                @update:model-value="fxDistortion = $event"
              />
              <Knob
                :model-value="fxDelayWet"
                :min="0"
                :max="100"
                :step="1"
                compact
                label="Delay"
                color="blue"
                :format-value="formatPercent"
                @update:model-value="fxDelayWet = $event"
              />
              <Knob
                :model-value="fxDelayTimeMs"
                :min="10"
                :max="2000"
                :step="10"
                compact
                label="D Time"
                color="blue"
                :format-value="formatMs"
                @update:model-value="fxDelayTimeMs = $event"
              />
              <Knob
                :model-value="fxReverbWet"
                :min="0"
                :max="100"
                :step="1"
                compact
                label="Reverb"
                color="purple"
                :format-value="formatPercent"
                @update:model-value="fxReverbWet = $event"
              />
              <Knob
                :model-value="fxReverbDecayMs"
                :min="100"
                :max="6000"
                :step="50"
                compact
                label="R Time"
                color="purple"
                :format-value="formatMs"
                @update:model-value="fxReverbDecayMs = $event"
              />
            </div>
          </div>
          <div
            v-else-if="activeEditorTab === 'eq'"
            class="sound-bar__playback-main sound-bar__playback-main--fx"
          >
            <div class="sound-bar__knobs-row sound-bar__knobs-row--fx">
              <Knob
                :model-value="eqLowDb"
                :min="-24"
                :max="24"
                :step="1"
                compact
                label="EQ Low"
                color="blue"
                :format-value="formatDb"
                @update:model-value="eqLowDb = $event"
              />
              <Knob
                :model-value="eqMidDb"
                :min="-24"
                :max="24"
                :step="1"
                compact
                label="EQ Mid"
                color="purple"
                :format-value="formatDb"
                @update:model-value="eqMidDb = $event"
              />
              <Knob
                :model-value="eqHighDb"
                :min="-24"
                :max="24"
                :step="1"
                compact
                label="EQ High"
                color="orange"
                :format-value="formatDb"
                @update:model-value="eqHighDb = $event"
              />
            </div>
          </div>
          <div
            v-else-if="activeEditorTab === 'compressor'"
            class="sound-bar__playback-main sound-bar__playback-main--fx sound-bar__playback-main--comp"
          >
            <div
              class="sound-bar__knobs-row sound-bar__knobs-row--fx sound-bar__knobs-row--compressor"
            >
              <Knob
                :model-value="fxCompressorThresholdDb"
                :min="-48"
                :max="0"
                :step="1"
                compact
                label="Thr"
                color="purple"
                :format-value="formatDb"
                @update:model-value="fxCompressorThresholdDb = $event"
              />
              <Knob
                :model-value="fxCompressorRatio"
                :min="1"
                :max="20"
                :step="0.5"
                compact
                label="Ratio"
                color="purple"
                :format-value="formatCompressorRatio"
                @update:model-value="fxCompressorRatio = $event"
              />
              <Knob
                :model-value="fxCompressorAttackMs"
                :min="1"
                :max="200"
                :step="1"
                compact
                label="C.Atk"
                color="purple"
                :format-value="formatMs"
                @update:model-value="fxCompressorAttackMs = $event"
              />
              <Knob
                :model-value="fxCompressorReleaseMs"
                :min="50"
                :max="800"
                :step="10"
                compact
                label="C.Rel"
                color="purple"
                :format-value="formatMs"
                @update:model-value="fxCompressorReleaseMs = $event"
              />
              <Knob
                :model-value="fxEnvelopeAttackMs"
                :min="0"
                :max="500"
                :step="5"
                compact
                label="Env A"
                color="orange"
                :format-value="formatMs"
                @update:model-value="fxEnvelopeAttackMs = $event"
              />
              <Knob
                :model-value="fxEnvelopeReleaseMs"
                :min="0"
                :max="800"
                :step="10"
                compact
                label="Env R"
                color="orange"
                :format-value="formatMs"
                @update:model-value="fxEnvelopeReleaseMs = $event"
              />
            </div>
          </div>
        </div>
        <div
          class="sound-bar__scroll meet-scroll"
          :class="{ 'sound-bar__scroll--upload': activeEditorTab === 'upload' }"
        >
          <SoundBarUploadPanel
            v-if="activeEditorTab === 'upload' && orgIdForUpload"
            variant="embed"
            :org-id="orgIdForUpload"
            :can-edit="canEditOrganizationSounds"
            class="sound-bar__upload-panel"
          />
          <template v-else>
            <p
              v-if="sounds.length === 0"
              class="sound-bar__empty-grid-hint"
            >
              Звуков пока нет. Откройте вкладку Upload, чтобы добавить.
            </p>
            <div v-else class="sound-bar__emoji-grid">
              <Button
                v-for="s in sounds"
                :key="s.id"
                type="icon"
                icon-size="40px"
                class="sound-bar__tile button--scale-disabled"
                :class="{
                  'sound-bar__tile--pressed': pressedEmoji === s.emoji,
                  'sound-bar__tile--sound-selected': selectedSoundId === s.id,
                }"
                :variant="tileVariant(s)"
                :disabled="!s.audioUrl"
                :title="tileTitle(s)"
                @click="handleRowClick(s)"
                @pointerdown="handlePointerDown(s, $event)"
                @pointerup="handlePointerUp(s)"
                @pointerleave="handlePointerUp(s)"
                @pointercancel="handlePointerUp(s)"
                @contextmenu.stop.prevent="onSoundContextMenu(s, $event)"
              >
                <button
                  type="button"
                  class="sound-bar__keybind-mini"
                  :class="{
                    'sound-bar__keybind-mini--bound': Boolean(
                      hotkeysBySoundId[s.id],
                    ),
                    'sound-bar__keybind-mini--capture':
                      bindingCaptureSoundId === s.id,
                  }"
                  :title="tileKeybindTitle(s)"
                  tabindex="-1"
                  @click.stop="onKeybindMiniClick(s, $event)"
                >
                  {{ hotkeyLabelForSound(s.id) || "·" }}
                </button>
                <span class="sound-bar__tile-emoji">{{ s.emoji }}</span>
                <div
                  v-if="tilePlaybackFlags(s).any"
                  class="sound-bar__tile-badges"
                >
                  <span
                    v-if="tilePlaybackFlags(s).loop"
                    class="sound-bar__badge"
                    >L</span
                  >
                  <span
                    v-if="tilePlaybackFlags(s).gate"
                    class="sound-bar__badge"
                    >D</span
                  >
                  <span
                    v-if="tilePlaybackFlags(s).reverse"
                    class="sound-bar__badge"
                    >R</span
                  >
                  <span
                    v-if="tilePlaybackFlags(s).pendulum"
                    class="sound-bar__badge"
                    >P</span
                  >
                </div>
              </Button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import type { Room as LiveKitRoom } from "livekit-client";

import { useOrganizationSounds, useSoundBarRoomChannel } from "../lib";
import type { OrganizationSound } from "../model/types";
import SoundBarUploadPanel from "./SoundBarUploadPanel.vue";
import { Button, Knob, PixelIcon, Switch } from "@shared/ui";
import {
  soundBarVolume,
  soundBarMuted,
  setSoundBarVolume,
  toggleSoundBarMuted,
  getSoundBarLocalUserId,
  preloadSoundBarAudioEntries,
  stopAllSoundBarPlaybackImmediately,
} from "@shared/lib";

const soundBarVolumeRef = soundBarVolume;
const soundBarMutedRef = soundBarMuted;

function onVolumeInput(e: Event) {
  setSoundBarVolume(Number((e.target as HTMLInputElement).value) / 100);
}

const props = withDefaults(
  defineProps<{
    orgId: string | null;
    livekitRoom: LiveKitRoom | null;
    previewMode?: boolean;
    layout?: "popover" | "panel";
    canEditOrganizationSounds?: boolean;
  }>(),
  { layout: "popover", canEditOrganizationSounds: true },
);

const hasOrg = computed(() => Boolean(props.orgId?.trim()));
const orgIdForUpload = computed(() => props.orgId?.trim() ?? "");

const rootRef = ref<HTMLElement | null>(null);
const popoverOpen = ref(false);

const isPanel = computed(() => props.layout === "panel");

const { startAndBroadcast, stopAndBroadcast, sessionByEmoji } =
  useSoundBarRoomChannel(() => props.livekitRoom);
const { sounds, isLoading: orgSoundsLoading } = useOrganizationSounds(
  () => props.orgId,
);

const soundBarDecodeReady = ref(true);
let soundBarPreloadGen = 0;

const soundBarSurfaceBlocked = computed(
  () =>
    Boolean(props.orgId?.trim()) &&
    sounds.value.length > 0 &&
    (isPanel.value || popoverOpen.value) &&
    (orgSoundsLoading.value || !soundBarDecodeReady.value),
);

watch(
  [
    () => props.orgId,
    sounds,
    () => orgSoundsLoading.value,
    popoverOpen,
    isPanel,
  ],
  async () => {
    const gen = ++soundBarPreloadGen;
    if (!props.orgId?.trim()) {
      soundBarDecodeReady.value = true;
      return;
    }
    if (!(isPanel.value || popoverOpen.value)) {
      return;
    }
    if (orgSoundsLoading.value) {
      if (gen === soundBarPreloadGen) soundBarDecodeReady.value = false;
      return;
    }
    const list = sounds.value;
    if (list.length === 0) {
      if (gen === soundBarPreloadGen) soundBarDecodeReady.value = true;
      return;
    }
    if (gen === soundBarPreloadGen) soundBarDecodeReady.value = false;
    try {
      await preloadSoundBarAudioEntries(
        list
          .filter((s) => Boolean(s.audioUrl?.trim()))
          .map((s) => ({ url: s.audioUrl!, version: s.version })),
      );
    } catch {
      /* разблокируем UI даже при ошибке decode */
    } finally {
      if (gen === soundBarPreloadGen) soundBarDecodeReady.value = true;
    }
  },
  { flush: "post" },
);

const previewMode = computed(() => props.previewMode ?? false);

const pressedEmoji = ref<string | null>(null);

const PANEL_STORAGE_V1 = "nonza_soundbar_playback_panel_v1";
const LEGACY_PANEL_V2 = "nonza_soundbar_playback_panel_v2";

function panelStorageKey(): string {
  const oid = props.orgId?.trim() || "_";
  return `nonza_soundbar_playback_panel_v3:${oid}:${getSoundBarLocalUserId()}`;
}

type StoredPlayback = {
  loop: boolean;
  gate: boolean;
  reverse: boolean;
  pendulum: boolean;
  clipVolume: number;
  clipSpeed: number;
  clipPitch: number;
  fxFilterHz: number;
  fxDistortion: number;
  fxDelayWet: number;
  fxDelayTimeMs: number;
  fxReverbWet: number;
  fxReverbDecayMs: number;
  eqLowDb: number;
  eqMidDb: number;
  eqHighDb: number;
  fxCompressorThresholdDb: number;
  fxCompressorRatio: number;
  fxCompressorAttackMs: number;
  fxCompressorReleaseMs: number;
  fxEnvelopeAttackMs: number;
  fxEnvelopeReleaseMs: number;
};

const DEFAULT_PLAYBACK: StoredPlayback = {
  loop: false,
  gate: false,
  reverse: false,
  pendulum: false,
  clipVolume: 100,
  clipSpeed: 100,
  clipPitch: 100,
  fxFilterHz: 20000,
  fxDistortion: 0,
  fxDelayWet: 0,
  fxDelayTimeMs: 200,
  fxReverbWet: 0,
  fxReverbDecayMs: 1200,
  eqLowDb: 0,
  eqMidDb: 0,
  eqHighDb: 0,
  fxCompressorThresholdDb: -24,
  fxCompressorRatio: 1,
  fxCompressorAttackMs: 10,
  fxCompressorReleaseMs: 250,
  fxEnvelopeAttackMs: 0,
  fxEnvelopeReleaseMs: 0,
};

const storePerSound = ref<Record<string, StoredPlayback>>({});
const selectedSoundId = ref<string | null>(null);
const legacyV1Panel = ref<StoredPlayback | null>(null);
const hotkeysBySoundId = ref<Record<string, string>>({});
const bindingCaptureSoundId = ref<string | null>(null);
const gateKeydownFromKeyboard = new Set<string>();
const gateEmojiByKeyCode = new Map<string, string>();

const panelLoop = ref(false);
const panelGate = ref(false);
const panelReverse = ref(false);
const panelPendulum = ref(false);
const clipVolumePct = ref(100);
const clipSpeedPct = ref(100);
const clipPitchPct = ref(100);
const fxFilterHz = ref(20000);
const fxDistortion = ref(0);
const fxDelayWet = ref(0);
const fxDelayTimeMs = ref(200);
const fxReverbWet = ref(0);
const fxReverbDecayMs = ref(1200);
const eqLowDb = ref(0);
const eqMidDb = ref(0);
const eqHighDb = ref(0);
const fxCompressorThresholdDb = ref(-24);
const fxCompressorRatio = ref(1);
const fxCompressorAttackMs = ref(10);
const fxCompressorReleaseMs = ref(250);
const fxEnvelopeAttackMs = ref(0);
const fxEnvelopeReleaseMs = ref(0);
const activeEditorTab = ref<
  "playback" | "fx" | "eq" | "compressor" | "upload"
>("playback");
const playbackStateReady = ref(false);
const DEBUG_KEY = "nonza_soundbar_debug";

function debugEnabled(): boolean {
  try {
    return localStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

function debugLog(event: string, payload?: unknown): void {
  if (!debugEnabled()) return;
  console.debug(`[soundbar/ui] ${event}`, payload ?? "");
}

function formatClipSpeed(v: number): string {
  return `${Math.round(v)}%`;
}

function formatClipVolume(v: number): string {
  return `${Math.round(v)}%`;
}

function formatClipPitch(v: number): string {
  return `${Math.round(v)}%`;
}

function formatFilterHz(v: number): string {
  return `${Math.round(v)}Hz`;
}

function formatPercent(v: number): string {
  return `${Math.round(v)}%`;
}

function formatMs(v: number): string {
  return `${Math.round(v)}ms`;
}

function formatDb(v: number): string {
  return `${Math.round(v)}dB`;
}

function formatCompressorRatio(v: number): string {
  const x = Math.round(v * 10) / 10;
  return `${x}:1`;
}

function setPanelLoop(v: boolean) {
  panelLoop.value = v;
}

function setPanelPendulum(v: boolean) {
  panelPendulum.value = v;
  if (v && !panelGate.value) {
    panelReverse.value = false;
  }
}

function setPanelGate(v: boolean) {
  panelGate.value = v;
}

function setPanelReverse(v: boolean) {
  panelReverse.value = v;
}

function clampSpeedPct(n: number): number {
  if (!Number.isFinite(n)) return 100;
  return Math.max(25, Math.min(400, Math.round(n)));
}

function normalizePlaybackRow(raw: Record<string, unknown>): StoredPlayback {
  const loop = typeof raw.loop === "boolean" ? raw.loop : DEFAULT_PLAYBACK.loop;
  const pendulum =
    typeof raw.pendulum === "boolean"
      ? raw.pendulum
      : DEFAULT_PLAYBACK.pendulum;
  return {
    loop,
    gate: typeof raw.gate === "boolean" ? raw.gate : DEFAULT_PLAYBACK.gate,
    reverse:
      typeof raw.reverse === "boolean" ? raw.reverse : DEFAULT_PLAYBACK.reverse,
    pendulum,
    clipVolume:
      typeof raw.clipVolume === "number"
        ? Math.max(0, Math.min(500, Math.round(raw.clipVolume)))
        : DEFAULT_PLAYBACK.clipVolume,
    clipSpeed:
      typeof raw.clipSpeed === "number"
        ? clampSpeedPct(raw.clipSpeed)
        : DEFAULT_PLAYBACK.clipSpeed,
    clipPitch:
      typeof raw.clipPitch === "number"
        ? clampSpeedPct(raw.clipPitch)
        : DEFAULT_PLAYBACK.clipPitch,
    fxFilterHz:
      typeof raw.fxFilterHz === "number"
        ? Math.max(200, Math.min(20000, Math.round(raw.fxFilterHz)))
        : DEFAULT_PLAYBACK.fxFilterHz,
    fxDistortion:
      typeof raw.fxDistortion === "number"
        ? Math.max(0, Math.min(100, Math.round(raw.fxDistortion)))
        : DEFAULT_PLAYBACK.fxDistortion,
    fxDelayWet:
      typeof raw.fxDelayWet === "number"
        ? Math.max(0, Math.min(100, Math.round(raw.fxDelayWet)))
        : DEFAULT_PLAYBACK.fxDelayWet,
    fxDelayTimeMs:
      typeof raw.fxDelayTimeMs === "number"
        ? Math.max(10, Math.min(2000, Math.round(raw.fxDelayTimeMs)))
        : DEFAULT_PLAYBACK.fxDelayTimeMs,
    fxReverbWet:
      typeof raw.fxReverbWet === "number"
        ? Math.max(0, Math.min(100, Math.round(raw.fxReverbWet)))
        : DEFAULT_PLAYBACK.fxReverbWet,
    fxReverbDecayMs:
      typeof raw.fxReverbDecayMs === "number"
        ? Math.max(100, Math.min(6000, Math.round(raw.fxReverbDecayMs)))
        : DEFAULT_PLAYBACK.fxReverbDecayMs,
    eqLowDb:
      typeof raw.eqLowDb === "number"
        ? Math.max(-24, Math.min(24, Math.round(raw.eqLowDb)))
        : DEFAULT_PLAYBACK.eqLowDb,
    eqMidDb:
      typeof raw.eqMidDb === "number"
        ? Math.max(-24, Math.min(24, Math.round(raw.eqMidDb)))
        : DEFAULT_PLAYBACK.eqMidDb,
    eqHighDb:
      typeof raw.eqHighDb === "number"
        ? Math.max(-24, Math.min(24, Math.round(raw.eqHighDb)))
        : DEFAULT_PLAYBACK.eqHighDb,
    fxCompressorThresholdDb: (() => {
      if (typeof raw.fxCompressorThresholdDb === "number") {
        return Math.max(-48, Math.min(0, Math.round(raw.fxCompressorThresholdDb)));
      }
      if (typeof raw.fxCompressorAmount === "number") {
        const amt = Math.max(0, Math.min(100, Math.round(raw.fxCompressorAmount)));
        if (amt <= 0) return DEFAULT_PLAYBACK.fxCompressorThresholdDb;
        return Math.max(-48, Math.min(0, Math.round(-18 - (amt / 100) * 24)));
      }
      return DEFAULT_PLAYBACK.fxCompressorThresholdDb;
    })(),
    fxCompressorRatio: (() => {
      if (typeof raw.fxCompressorRatio === "number") {
        return Math.max(1, Math.min(20, Math.round(raw.fxCompressorRatio * 2) / 2));
      }
      if (typeof raw.fxCompressorAmount === "number") {
        const amt = Math.max(0, Math.min(100, Math.round(raw.fxCompressorAmount)));
        if (amt <= 0) return 1;
        return Math.max(1, Math.min(20, Math.round((2 + (amt / 100) * 10) * 10) / 10));
      }
      return DEFAULT_PLAYBACK.fxCompressorRatio;
    })(),
    fxCompressorAttackMs:
      typeof raw.fxCompressorAttackMs === "number"
        ? Math.max(1, Math.min(200, Math.round(raw.fxCompressorAttackMs)))
        : DEFAULT_PLAYBACK.fxCompressorAttackMs,
    fxCompressorReleaseMs:
      typeof raw.fxCompressorReleaseMs === "number"
        ? Math.max(50, Math.min(800, Math.round(raw.fxCompressorReleaseMs)))
        : DEFAULT_PLAYBACK.fxCompressorReleaseMs,
    fxEnvelopeAttackMs:
      typeof raw.fxEnvelopeAttackMs === "number"
        ? Math.max(0, Math.min(500, Math.round(raw.fxEnvelopeAttackMs)))
        : DEFAULT_PLAYBACK.fxEnvelopeAttackMs,
    fxEnvelopeReleaseMs:
      typeof raw.fxEnvelopeReleaseMs === "number"
        ? Math.max(0, Math.min(800, Math.round(raw.fxEnvelopeReleaseMs)))
        : DEFAULT_PLAYBACK.fxEnvelopeReleaseMs,
  };
}

function seedFromOrg(sound: OrganizationSound): StoredPlayback {
  return normalizePlaybackRow({
    loop: sound.loopEnabled,
    gate: sound.gateEnabled,
    reverse: false,
    pendulum: false,
    clipVolume: 100,
    clipSpeed: sound.speed,
    clipPitch: 100,
  });
}

function effectivePlaybackForSound(sound: OrganizationSound): StoredPlayback {
  const row = storePerSound.value[sound.id];
  if (row) return row;
  return seedFromOrg(sound);
}

function hasStoredProfile(soundId: string): boolean {
  return Boolean(storePerSound.value[soundId]);
}

function playbackSnapshotForStart(sound: OrganizationSound): StoredPlayback {
  if (selectedSoundId.value === sound.id) {
    return storedFromRefs();
  }
  return effectivePlaybackForSound(sound);
}

function tilePlaybackFlags(sound: OrganizationSound): {
  any: boolean;
  loop: boolean;
  gate: boolean;
  reverse: boolean;
  pendulum: boolean;
} {
  const p = effectivePlaybackForSound(sound);
  return {
    any: p.loop || p.gate || p.reverse || p.pendulum,
    loop: p.loop,
    gate: p.gate,
    reverse: p.reverse,
    pendulum: p.pendulum,
  };
}

function ensureDefaultSoundSelection(list: OrganizationSound[]): void {
  if (list.length === 0) return;
  const cur = selectedSoundId.value;
  if (cur && list.some((s) => s.id === cur)) return;

  if (cur !== null) {
    commitActiveSnapshot();
  }

  const next = list.find((s) => s.audioUrl)?.id ?? list[0]!.id;
  selectedSoundId.value = next;

  if (legacyV1Panel.value && !storePerSound.value[next]) {
    storePerSound.value = {
      ...storePerSound.value,
      [next]: legacyV1Panel.value,
    };
    legacyV1Panel.value = null;
  }
}

function refsFromStored(s: StoredPlayback) {
  panelLoop.value = s.loop;
  panelGate.value = s.gate;
  panelReverse.value = s.reverse;
  panelPendulum.value = s.pendulum;
  clipVolumePct.value = s.clipVolume;
  clipSpeedPct.value = s.clipSpeed;
  clipPitchPct.value = s.clipPitch;
  fxFilterHz.value = s.fxFilterHz;
  fxDistortion.value = s.fxDistortion;
  fxDelayWet.value = s.fxDelayWet;
  fxDelayTimeMs.value = s.fxDelayTimeMs;
  fxReverbWet.value = s.fxReverbWet;
  fxReverbDecayMs.value = s.fxReverbDecayMs;
  eqLowDb.value = s.eqLowDb;
  eqMidDb.value = s.eqMidDb;
  eqHighDb.value = s.eqHighDb;
  fxCompressorThresholdDb.value = s.fxCompressorThresholdDb;
  fxCompressorRatio.value = s.fxCompressorRatio;
  fxCompressorAttackMs.value = s.fxCompressorAttackMs;
  fxCompressorReleaseMs.value = s.fxCompressorReleaseMs;
  fxEnvelopeAttackMs.value = s.fxEnvelopeAttackMs;
  fxEnvelopeReleaseMs.value = s.fxEnvelopeReleaseMs;
}

function storedFromRefs(): StoredPlayback {
  return normalizePlaybackRow({
    loop: panelLoop.value,
    gate: panelGate.value,
    reverse: panelReverse.value,
    pendulum: panelPendulum.value,
    clipVolume: clipVolumePct.value,
    clipSpeed: clipSpeedPct.value,
    clipPitch: clipPitchPct.value,
    fxFilterHz: fxFilterHz.value,
    fxDistortion: fxDistortion.value,
    fxDelayWet: fxDelayWet.value,
    fxDelayTimeMs: fxDelayTimeMs.value,
    fxReverbWet: fxReverbWet.value,
    fxReverbDecayMs: fxReverbDecayMs.value,
    eqLowDb: eqLowDb.value,
    eqMidDb: eqMidDb.value,
    eqHighDb: eqHighDb.value,
    fxCompressorThresholdDb: fxCompressorThresholdDb.value,
    fxCompressorRatio: fxCompressorRatio.value,
    fxCompressorAttackMs: fxCompressorAttackMs.value,
    fxCompressorReleaseMs: fxCompressorReleaseMs.value,
    fxEnvelopeAttackMs: fxEnvelopeAttackMs.value,
    fxEnvelopeReleaseMs: fxEnvelopeReleaseMs.value,
  });
}

function playbackRowEquals(a: StoredPlayback, b: StoredPlayback): boolean {
  return (
    a.loop === b.loop &&
    a.gate === b.gate &&
    a.reverse === b.reverse &&
    a.pendulum === b.pendulum &&
    a.clipVolume === b.clipVolume &&
    a.clipSpeed === b.clipSpeed &&
    a.clipPitch === b.clipPitch &&
    a.fxFilterHz === b.fxFilterHz &&
    a.fxDistortion === b.fxDistortion &&
    a.fxDelayWet === b.fxDelayWet &&
    a.fxDelayTimeMs === b.fxDelayTimeMs &&
    a.fxReverbWet === b.fxReverbWet &&
    a.fxReverbDecayMs === b.fxReverbDecayMs &&
    a.eqLowDb === b.eqLowDb &&
    a.eqMidDb === b.eqMidDb &&
    a.eqHighDb === b.eqHighDb &&
    a.fxCompressorThresholdDb === b.fxCompressorThresholdDb &&
    a.fxCompressorRatio === b.fxCompressorRatio &&
    a.fxCompressorAttackMs === b.fxCompressorAttackMs &&
    a.fxCompressorReleaseMs === b.fxCompressorReleaseMs &&
    a.fxEnvelopeAttackMs === b.fxEnvelopeAttackMs &&
    a.fxEnvelopeReleaseMs === b.fxEnvelopeReleaseMs
  );
}

function persistAll(): void {
  try {
    localStorage.setItem(
      panelStorageKey(),
      JSON.stringify({
        perSound: storePerSound.value,
        selectedId: selectedSoundId.value,
        hotkeys: hotkeysBySoundId.value,
      }),
    );
  } catch {
    /* ignore */
  }
}

type StoredPanelJson = {
  perSound?: Record<string, Record<string, unknown>>;
  selectedId?: string | null;
  hotkeys?: Record<string, unknown>;
};

function applyStoredPayload(j: StoredPanelJson): void {
  if (j.perSound && typeof j.perSound === "object") {
    const next: Record<string, StoredPlayback> = {};
    for (const [k, row] of Object.entries(j.perSound)) {
      if (row && typeof row === "object") {
        next[k] = normalizePlaybackRow(row);
      }
    }
    storePerSound.value = next;
  }
  selectedSoundId.value =
    typeof j.selectedId === "string" && j.selectedId.length > 0
      ? j.selectedId
      : null;

  if (j.hotkeys && typeof j.hotkeys === "object" && !Array.isArray(j.hotkeys)) {
    const nh: Record<string, string> = {};
    for (const [sid, code] of Object.entries(j.hotkeys)) {
      if (typeof code === "string" && code.length >= 2 && code.length < 32) {
        nh[sid] = code;
      }
    }
    hotkeysBySoundId.value = nh;
  } else {
    hotkeysBySoundId.value = {};
  }
}

function loadLegacyV1IfNeeded(): void {
  try {
    const raw1 = localStorage.getItem(PANEL_STORAGE_V1);
    if (raw1) {
      const j = JSON.parse(raw1) as Record<string, unknown>;
      legacyV1Panel.value = normalizePlaybackRow(j);
    }
  } catch {
    /* ignore */
  }
}

function loadPersisted(): void {
  try {
    const primary = localStorage.getItem(panelStorageKey());
    if (primary) {
      applyStoredPayload(JSON.parse(primary) as StoredPanelJson);
      loadLegacyV1IfNeeded();
      return;
    }
    const legacyV2 = localStorage.getItem(LEGACY_PANEL_V2);
    if (legacyV2) {
      applyStoredPayload(JSON.parse(legacyV2) as StoredPanelJson);
      persistAll();
      loadLegacyV1IfNeeded();
      return;
    }
    hotkeysBySoundId.value = {};
    loadLegacyV1IfNeeded();
  } catch {
    /* ignore */
  }
}

function hydratePlaybackStateFromCurrentSources(): void {
  const list = sounds.value;
  if (list.length === 0) {
    popoverOpen.value = false;
    selectedSoundId.value = null;
    persistAll();
    playbackStateReady.value = true;
    return;
  }
  ensureDefaultSoundSelection(list);
  hydrateRefsForSelection();
  playbackStateReady.value = true;
}

function ensurePlaybackStateReady(): void {
  if (playbackStateReady.value) return;
  debugLog("ensurePlaybackStateReady:start", {
    orgId: props.orgId,
    selectedSoundId: selectedSoundId.value,
  });
  loadPersisted();
  hydratePlaybackStateFromCurrentSources();
  debugLog("ensurePlaybackStateReady:done", {
    orgId: props.orgId,
    selectedSoundId: selectedSoundId.value,
    storeSize: Object.keys(storePerSound.value).length,
  });
}

function commitActiveSnapshot(): void {
  const id = selectedSoundId.value;
  if (id === null) return;
  const sound = sounds.value.find((s) => s.id === id);
  if (!sound) return;
  const snap = storedFromRefs();
  const seed = seedFromOrg(sound);
  if (playbackRowEquals(snap, seed)) {
    if (storePerSound.value[id]) {
      const { [id]: _drop, ...rest } = storePerSound.value;
      storePerSound.value = rest;
    }
    persistAll();
    return;
  }
  storePerSound.value = { ...storePerSound.value, [id]: snap };
  persistAll();
}

function hydrateRefsForSelection(): void {
  const id = selectedSoundId.value;
  if (id === null) {
    refsFromStored(DEFAULT_PLAYBACK);
    return;
  }
  const sound = sounds.value.find((s) => s.id === id);
  if (!sound) {
    refsFromStored(DEFAULT_PLAYBACK);
    return;
  }
  refsFromStored(effectivePlaybackForSound(sound));
}

function selectProfile(sound: OrganizationSound): void {
  if (!sound.audioUrl) return;
  const createProfileFromCurrentRefsIfMissing = () => {
    if (hasStoredProfile(sound.id)) return;
    storePerSound.value = {
      ...storePerSound.value,
      [sound.id]: storedFromRefs(),
    };
  };

  if (selectedSoundId.value === null) {
    selectedSoundId.value = sound.id;
    refsFromStored(effectivePlaybackForSound(sound));
    persistAll();
    return;
  }
  commitActiveSnapshot();
  if (selectedSoundId.value === sound.id) {
    createProfileFromCurrentRefsIfMissing();
    persistAll();
    return;
  }
  selectedSoundId.value = sound.id;
  refsFromStored(effectivePlaybackForSound(sound));
  persistAll();
}

function onSoundContextMenu(sound: OrganizationSound, ev: MouseEvent): void {
  if (previewMode.value) return;
  if (!sound.audioUrl) return;
  ev.preventDefault();
  selectProfile(sound);
}

function broadcastPlaybackForSound(sound: OrganizationSound) {
  const snap = playbackSnapshotForStart(sound);
  const volPct = Number.isFinite(sound.volume) ? sound.volume : 100;
  const baseVolume = Math.max(0, Math.min(5, volPct / 100));
  const profileVolume = Math.max(0, Math.min(5, snap.clipVolume / 100));
  return {
    loopEnabled: snap.loop,
    gateEnabled: snap.gate,
    sessionVolume: Math.max(0, Math.min(5, baseVolume * profileVolume)),
    playbackSpeed: Math.max(0.25, Math.min(4, snap.clipSpeed / 100)),
    playbackPitch: Math.max(0.25, Math.min(4, snap.clipPitch / 100)),
    fx: {
      filterHz: snap.fxFilterHz,
      distortion: snap.fxDistortion,
      delayWet: snap.fxDelayWet,
      delayTimeMs: snap.fxDelayTimeMs,
      reverbWet: snap.fxReverbWet,
      reverbDecayMs: snap.fxReverbDecayMs,
      eqLowDb: snap.eqLowDb,
      eqMidDb: snap.eqMidDb,
      eqHighDb: snap.eqHighDb,
      compressorThresholdDb: snap.fxCompressorThresholdDb,
      compressorRatio: snap.fxCompressorRatio,
      compressorAttackMs: snap.fxCompressorAttackMs,
      compressorReleaseMs: snap.fxCompressorReleaseMs,
      envelopeAttackMs: snap.fxEnvelopeAttackMs,
      envelopeReleaseMs: snap.fxEnvelopeReleaseMs,
    },
    reverse: snap.reverse && (!snap.pendulum || snap.gate),
    pendulum: snap.pendulum,
  };
}

watch(sounds, (list) => {
  const idSet = new Set(list.map((s) => s.id));
  let hkDirty = false;
  const nh = { ...hotkeysBySoundId.value };
  for (const k of Object.keys(nh)) {
    if (!idSet.has(k)) {
      delete nh[k];
      hkDirty = true;
    }
  }
  if (hkDirty) {
    hotkeysBySoundId.value = nh;
    persistAll();
  }

  if (list.length === 0) {
    popoverOpen.value = false;
    selectedSoundId.value = null;
    persistAll();
    playbackStateReady.value = true;
    return;
  }
  ensureDefaultSoundSelection(list);
  hydrateRefsForSelection();
  playbackStateReady.value = true;
});

watch(
  () => props.orgId,
  () => {
    playbackStateReady.value = false;
    loadPersisted();
    hydratePlaybackStateFromCurrentSources();
  },
  { immediate: true },
);

function attachWindowHotkeys(): void {
  window.addEventListener("keydown", handleWindowKeydown, true);
  window.addEventListener("keyup", handleWindowKeyup, true);
}

function detachWindowHotkeys(): void {
  window.removeEventListener("keydown", handleWindowKeydown, true);
  window.removeEventListener("keyup", handleWindowKeyup, true);
}

onMounted(() => {
  if (!previewMode.value) attachWindowHotkeys();
});

watch(previewMode, (p) => {
  if (p) detachWindowHotkeys();
  else attachWindowHotkeys();
});

watch(
  [
    panelLoop,
    panelGate,
    panelReverse,
    panelPendulum,
    clipVolumePct,
    clipSpeedPct,
    clipPitchPct,
    fxFilterHz,
    fxDistortion,
    fxDelayWet,
    fxDelayTimeMs,
    fxReverbWet,
    fxReverbDecayMs,
    eqLowDb,
    eqMidDb,
    eqHighDb,
    fxCompressorThresholdDb,
    fxCompressorRatio,
    fxCompressorAttackMs,
    fxCompressorReleaseMs,
    fxEnvelopeAttackMs,
    fxEnvelopeReleaseMs,
  ],
  () => {
    commitActiveSnapshot();
  },
);

let detachOutside: (() => void) | null = null;

watch(popoverOpen, (open) => {
  detachOutside?.();
  detachOutside = null;
  if (!open || isPanel.value) return;
  void nextTick(() => {
    const onDown = (ev: PointerEvent) => {
      const root = rootRef.value;
      if (!root?.contains(ev.target as Node)) {
        popoverOpen.value = false;
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    detachOutside = () =>
      document.removeEventListener("pointerdown", onDown, true);
  });
});

onUnmounted(() => {
  detachOutside?.();
  detachOutside = null;
  detachWindowHotkeys();
});

function togglePopover() {
  popoverOpen.value = !popoverOpen.value;
}

function createSessionId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isActive(emoji: string): boolean {
  return (sessionByEmoji.value[emoji]?.length ?? 0) > 0;
}

function tileTitle(s: OrganizationSound): string {
  const bits: string[] = [];
  if (s.title?.trim()) bits.push(s.title.trim());
  if (storePerSound.value[s.id]) bits.push("свои настройки");
  const f = tilePlaybackFlags(s);
  const letters: string[] = [];
  if (f.loop) letters.push("L");
  if (f.gate) letters.push("D");
  if (f.reverse) letters.push("R");
  if (f.pendulum) letters.push("P");
  if (letters.length) bits.push(letters.join(""));
  bits.push(
    "ЛКМ — выбор и звук · ПКМ — только выбор · метка «·» слева снизу — горячая клавиша",
  );
  return bits.join(" · ");
}

function tileVariant(s: OrganizationSound): "primary" | "default" {
  return isActive(s.emoji) ? "primary" : "default";
}

function isKeyboardFormTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const t = target.tagName.toLowerCase();
  if (t === "input" || t === "textarea" || t === "select") return true;
  return target.isContentEditable;
}

function gatePressStart(sound: OrganizationSound): void {
  if (previewMode.value) return;
  if (!sound.audioUrl) return;
  ensurePlaybackStateReady();
  selectProfile(sound);
  const cfg = broadcastPlaybackForSound(sound);
  debugLog("gatePressStart:cfg", {
    soundId: sound.id,
    emoji: sound.emoji,
    cfg,
    selectedSoundId: selectedSoundId.value,
  });
  if (!cfg.gateEnabled) return;
  const existingIds = sessionByEmoji.value[sound.emoji] ?? [];
  for (const id of existingIds) {
    void stopAndBroadcast({ sessionId: id });
  }
  const sessionId = createSessionId();
  sessionByEmoji.value = {
    ...sessionByEmoji.value,
    [sound.emoji]: [sessionId],
  };
  pressedEmoji.value = sound.emoji;
  void startAndBroadcast({
    sessionId,
    emoji: sound.emoji,
    audioUrl: sound.audioUrl,
    audioVersion: sound.version,
    ...cfg,
  });
}

function gatePressEnd(sound: OrganizationSound): void {
  if (previewMode.value) return;
  for (const [code, emoji] of gateEmojiByKeyCode.entries()) {
    if (emoji === sound.emoji) {
      gateEmojiByKeyCode.delete(code);
    }
  }
  gateKeydownFromKeyboard.delete(sound.emoji);
  const cfg = broadcastPlaybackForSound(sound);
  if (!cfg.gateEnabled) return;
  const ids = sessionByEmoji.value[sound.emoji] ?? [];
  const sessionId = ids[ids.length - 1];
  if (!sessionId) return;
  void stopAndBroadcast({ sessionId });
  if (pressedEmoji.value === sound.emoji) pressedEmoji.value = null;
}

function codeToShortLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return code.slice(6);
  if (code.startsWith("Arrow")) return code.slice(5);
  return code;
}

function hotkeyLabelForSound(soundId: string): string {
  const code = hotkeysBySoundId.value[soundId];
  return code ? codeToShortLabel(code) : "";
}

function tileKeybindTitle(sound: OrganizationSound): string {
  if (bindingCaptureSoundId.value === sound.id) {
    return "Нажми клавишу. Esc — отмена. Alt+клик — сброс";
  }
  const h = hotkeysBySoundId.value[sound.id];
  if (h) return `Клавиша: ${h}. Клик — сменить. Alt+клик — сброс`;
  return "Клик — привязать клавишу";
}

function onKeybindMiniClick(sound: OrganizationSound, ev: MouseEvent): void {
  if (previewMode.value) return;
  if (!sound.audioUrl) return;
  if (ev.altKey) {
    const next = { ...hotkeysBySoundId.value };
    delete next[sound.id];
    hotkeysBySoundId.value = next;
    persistAll();
    return;
  }
  if (bindingCaptureSoundId.value === sound.id) {
    bindingCaptureSoundId.value = null;
    return;
  }
  bindingCaptureSoundId.value = sound.id;
}

function assignHotkey(soundId: string, code: string): void {
  const next: Record<string, string> = { ...hotkeysBySoundId.value };
  for (const [k, v] of Object.entries(next)) {
    if (k !== soundId && v === code) {
      delete next[k];
    }
  }
  next[soundId] = code;
  hotkeysBySoundId.value = next;
  persistAll();
}

function stopAllActivePlayback(): void {
  const activeSessionIds = Object.values(sessionByEmoji.value).flat();
  stopAllSoundBarPlaybackImmediately();
  for (const sessionId of activeSessionIds) {
    void stopAndBroadcast({ sessionId });
  }
  sessionByEmoji.value = {};
  pressedEmoji.value = null;
  gateKeydownFromKeyboard.clear();
  gateEmojiByKeyCode.clear();
}

function handleWindowKeydown(e: KeyboardEvent): void {
  if (previewMode.value) return;
  ensurePlaybackStateReady();

  if (bindingCaptureSoundId.value) {
    if (isKeyboardFormTarget(e.target)) return;
    if (e.code === "Escape") {
      bindingCaptureSoundId.value = null;
      e.preventDefault();
      return;
    }
    const neuKeys = new Set([
      "ControlLeft",
      "ControlRight",
      "ShiftLeft",
      "ShiftRight",
      "AltLeft",
      "AltRight",
      "MetaLeft",
      "MetaRight",
      "CapsLock",
    ]);
    if (neuKeys.has(e.code)) return;
    const sid = bindingCaptureSoundId.value;
    if (sid) {
      assignHotkey(sid, e.code);
      bindingCaptureSoundId.value = null;
      e.preventDefault();
    }
    return;
  }

  if (isKeyboardFormTarget(e.target)) return;
  if (e.code === "Escape") {
    e.preventDefault();
    stopAllActivePlayback();
    return;
  }

  const hit = Object.entries(hotkeysBySoundId.value).find(
    ([, c]) => c === e.code,
  );
  if (!hit) return;
  const sound = sounds.value.find((s) => s.id === hit[0]);
  if (!sound?.audioUrl) return;

  selectProfile(sound);
  const cfg = broadcastPlaybackForSound(sound);
  debugLog("hotkey:keydown:cfg", {
    code: e.code,
    soundId: sound.id,
    emoji: sound.emoji,
    cfg,
    selectedSoundId: selectedSoundId.value,
  });
  if (cfg.gateEnabled) {
    if (gateKeydownFromKeyboard.has(sound.emoji)) return;
    gateKeydownFromKeyboard.add(sound.emoji);
    gateEmojiByKeyCode.set(e.code, sound.emoji);
    e.preventDefault();
    gatePressStart(sound);
    return;
  }
  if (e.repeat) return;
  e.preventDefault();
  handleRowClick(sound);
}

function handleWindowKeyup(e: KeyboardEvent): void {
  if (previewMode.value) return;
  if (isKeyboardFormTarget(e.target)) return;
  const emoji = gateEmojiByKeyCode.get(e.code);
  if (!emoji) return;
  gateEmojiByKeyCode.delete(e.code);
  if (!gateKeydownFromKeyboard.has(emoji)) return;
  gateKeydownFromKeyboard.delete(emoji);
  e.preventDefault();
  const sound = sounds.value.find((s) => s.emoji === emoji);
  if (sound) {
    gatePressEnd(sound);
    return;
  }
  const ids = sessionByEmoji.value[emoji] ?? [];
  const sessionId = ids[ids.length - 1];
  if (!sessionId) return;
  void stopAndBroadcast({ sessionId });
}

function handlePointerDown(sound: OrganizationSound, ev: PointerEvent) {
  if (previewMode.value) return;
  if (!sound.audioUrl) return;
  ensurePlaybackStateReady();
  selectProfile(sound);
  const cfg = broadcastPlaybackForSound(sound);
  debugLog("pointerDown:cfg", {
    soundId: sound.id,
    emoji: sound.emoji,
    cfg,
    selectedSoundId: selectedSoundId.value,
  });
  if (!cfg.gateEnabled) return;
  if (ev.button !== 0) return;
  ev.preventDefault();
  gatePressStart(sound);
}

function handlePointerUp(sound: OrganizationSound) {
  gatePressEnd(sound);
}

function handleRowClick(sound: OrganizationSound) {
  if (previewMode.value) return;
  if (!sound.audioUrl) return;
  ensurePlaybackStateReady();
  selectProfile(sound);
  const cfg = broadcastPlaybackForSound(sound);
  debugLog("rowClick:cfg", {
    soundId: sound.id,
    emoji: sound.emoji,
    cfg,
    selectedSoundId: selectedSoundId.value,
  });
  if (cfg.gateEnabled) return;

  const existingIds = sessionByEmoji.value[sound.emoji] ?? [];

  if (cfg.loopEnabled) {
    if (existingIds.length > 0) {
      for (const id of existingIds) {
        void stopAndBroadcast({ sessionId: id });
      }
      return;
    }

    const sessionId = createSessionId();
    sessionByEmoji.value = {
      ...sessionByEmoji.value,
      [sound.emoji]: [sessionId],
    };
    void startAndBroadcast({
      sessionId,
      emoji: sound.emoji,
      audioUrl: sound.audioUrl,
      audioVersion: sound.version,
      ...cfg,
    });
    return;
  }

  const sessionId = createSessionId();
  const cur = sessionByEmoji.value[sound.emoji] ?? [];
  sessionByEmoji.value = {
    ...sessionByEmoji.value,
    [sound.emoji]: [...cur, sessionId],
  };
  void startAndBroadcast({
    sessionId,
    emoji: sound.emoji,
    audioUrl: sound.audioUrl,
    audioVersion: sound.version,
    ...cfg,
    onLocalPlaybackEnded: () => {
      const list = sessionByEmoji.value[sound.emoji] ?? [];
      if (!list.includes(sessionId)) return;
      const filtered = list.filter((id) => id !== sessionId);
      const next = { ...sessionByEmoji.value };
      if (filtered.length === 0) delete next[sound.emoji];
      else next[sound.emoji] = filtered;
      sessionByEmoji.value = next;
    },
  });
}
</script>

<style scoped>
.sound-bar {
  position: relative;
  display: flex;
  align-items: center;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.sound-bar--panel-root {
  width: 100%;
  align-items: stretch;
  min-height: 0;
}

.sound-bar__host {
  position: relative;
  display: flex;
  align-items: center;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.sound-bar__host--panel {
  width: 100%;
  flex-direction: column;
  align-items: stretch;
  min-height: 0;
}

.sound-bar__decode-blocker {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 10, 10, 0.72);
  pointer-events: all;
}

.sound-bar__surface--popover {
  position: absolute;
  bottom: calc(100% + 10px);
  right: 0;
  z-index: 10020;

  display: flex;
  flex-direction: column;
  min-width: min(160px, 85vw);
  max-width: min(280px, 92vw);
  max-height: min(58vh, 480px);
  min-height: 0;
  padding: 10px 12px;
  box-sizing: border-box;

  background: #1a1a1ae6;
  border: 3px solid #333;
  border-top-color: #444;
  border-left-color: #444;
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.sound-bar__surface--panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: none;
  min-width: 0;
  min-height: 0;
  max-height: min(40vh, 380px);
  flex: 1 1 auto;
  padding: 10px 12px;
  box-sizing: border-box;
  background: #141414f2;
  border: 2px solid #333;
  border-top-color: #444;
  border-left-color: #444;
  box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.35);
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.sound-bar__surface--empty {
  justify-content: center;
  align-items: center;
  min-height: 72px;
  max-height: none;
  flex: 0 0 auto;
}

.sound-bar__empty-text {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.42);
  text-align: center;
}

.sound-bar__empty-grid-hint {
  margin: 10px 4px 14px;
  font-size: 11px;
  line-height: 1.45;
  color: rgba(186, 177, 168, 0.72);
  text-align: center;
}

.sound-bar__scroll--upload {
  user-select: text;
  -webkit-user-select: text;
}

.sound-bar__upload-panel {
  padding-bottom: 6px;
}

.sound-bar__volume {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  margin-bottom: 6px;
  border-bottom: 1px solid #333;
}

.sound-bar__playback {
  flex-shrink: 0;
  container-type: inline-size;
  container-name: sound-bar-playback;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding-bottom: 6px;
  margin-bottom: 5px;
  border-bottom: 1px solid #333;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.78);
}

.sound-bar__playback-tabs {
  display: flex;
  gap: 0;
  border: 2px solid #333;
  border-top-color: #444;
  border-left-color: #444;
  background: #101010;
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.05);
}

.sound-bar__playback-tab {
  appearance: none;
  border: 0;
  border-right: 1px solid #2b2b2b;
  padding: 4px 10px 5px;
  background: #1a1a1a;
  color: rgba(186, 177, 168, 0.82);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
}

.sound-bar__playback-tab:last-child {
  border-right: 0;
}

.sound-bar__playback-tab:hover {
  background: #242424;
}

.sound-bar__playback-tab--active {
  background: #2f4f73;
  color: #eaf4ff;
  box-shadow: inset 0 -2px 0 #8fc4ff;
}

.sound-bar__playback-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  min-width: 0;
}

.sound-bar__playback-main--fx {
  justify-content: center;
}

.sound-bar__playback-main--comp {
  align-items: stretch;
}

.sound-bar__knobs-row--compressor {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  width: 100%;
  gap: 1px;
  justify-items: center;
}

@container sound-bar-playback (max-width: 210px) {
  .sound-bar__playback-main {
    flex-direction: column;
    align-items: stretch;
  }

  .sound-bar__knobs-row {
    margin-left: 0;
    justify-content: center;
  }
}

.sound-bar__edit-target {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 18px;
}

.sound-bar__edit-target-text {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 9px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sound-bar__edit-target-emoji {
  font-size: 13px;
  margin-left: 5px;
  vertical-align: -0.05em;
  text-transform: none;
  letter-spacing: normal;
}

.sound-bar__knobs-row {
  display: flex;
  flex-direction: row;
  flex-shrink: 0;
  margin-left: auto;
  justify-content: center;
  align-items: flex-end;
  gap: 6px;
  min-width: 72px;
}

.sound-bar__knobs-row--fx {
  margin-left: 0;
}

.sound-bar__knobs-row :deep(.knob-control__label),
.sound-bar__knobs-row :deep(.knob-control__value) {
  min-height: 10px;
  line-height: 1;
}

.sound-bar__knobs-row :deep(.knob-control--compact .knob-control__handle) {
  top: -3px;
  height: 12px;
}

.sound-bar__toggles {
  flex: 1 1 118px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px 8px;
  align-items: center;
  min-width: 0;
}

.sound-bar__toggles :deep(.pixel-switch) {
  gap: 6px;
  font-size: 9px;
}

.sound-bar__toggles :deep(.pixel-switch__label) {
  font-size: 9px;
  color: rgba(186, 177, 168, 0.92);
}

.sound-bar__toggles :deep(.pixel-switch__track) {
  width: 40px;
  height: 22px;
  border-width: 2px;
  padding: 1px;
  box-shadow: 1px 1px 0 0 rgba(0, 0, 0, 0.28);
}

.sound-bar__toggles :deep(.pixel-switch__thumb) {
  width: 15px;
  height: 15px;
}

.sound-bar__toggles
  :deep(
    .pixel-switch__input:checked + .pixel-switch__track .pixel-switch__thumb
  ) {
  transform: translateX(18px);
}

.sound-bar__mute-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.7;
  color: inherit;
}

.sound-bar__mute-btn:hover {
  opacity: 1;
}

.sound-bar__scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  margin: 0 -4px;
  padding: 0 4px;
}

.sound-bar__emoji-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
  justify-items: stretch;
  align-items: stretch;
  width: 100%;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.sound-bar__surface--panel .sound-bar__emoji-grid {
  grid-template-columns: repeat(auto-fill, 44px);
  justify-content: start;
  column-gap: 3px;
  row-gap: 5px;
}

:deep(.sound-bar__tile.button) {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  width: 100%;
  min-width: 0;
  padding: 2px 2px 3px;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: manipulation;
}

:deep(.sound-bar__tile.button.sound-bar__tile--pressed),
:deep(
  .sound-bar__tile.button.sound-bar__tile--pressed:hover:not(.button--disabled)
),
:deep(
  .sound-bar__tile.button.sound-bar__tile--pressed:active:not(.button--disabled)
) {
  background: #3a6a9a;
}

:deep(.sound-bar__tile--sound-selected.button) {
  outline: 2px solid #6a9fd4;
  outline-offset: -1px;
}

.sound-bar__tile-emoji {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  line-height: 1;
  pointer-events: none;
}

.sound-bar__tile-badges {
  position: absolute;
  top: 1px;
  right: 1px;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 1px;
  max-width: calc(100% - 4px);
  line-height: 1;
  pointer-events: none;
}

.sound-bar__badge {
  font-size: 7px;
  font-weight: 600;
  line-height: 1;
  padding: 1px 3px;
  border: 1px solid #2a2a2a;
  background: #141414;
  color: #9a928a;
  user-select: none;
  pointer-events: none;
}

.sound-bar__keybind-mini {
  position: absolute;
  left: 2px;
  bottom: 2px;
  z-index: 2;
  box-sizing: border-box;
  min-width: 12px;
  height: 11px;
  padding: 0 2px;
  margin: 0;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.38);
  color: rgba(255, 255, 255, 0.55);
  font-size: 7px;
  font-weight: 600;
  line-height: 10px;
  letter-spacing: -0.02em;
  cursor: pointer;
  pointer-events: auto;
  font-family: inherit;
}

.sound-bar__keybind-mini--bound {
  color: rgba(186, 210, 255, 0.96);
  border-color: rgba(110, 150, 210, 0.55);
}

.sound-bar__keybind-mini--capture {
  animation: sound-bar-kb-pulse 0.55s ease-in-out infinite alternate;
}

@keyframes sound-bar-kb-pulse {
  from {
    opacity: 0.45;
    border-color: rgba(255, 200, 120, 0.45);
  }
  to {
    opacity: 1;
    border-color: rgba(255, 220, 140, 0.85);
  }
}
</style>
