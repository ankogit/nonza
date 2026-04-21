<template>
  <div
    v-if="!previewMode"
    ref="rootRef"
    class="sound-bar"
    :class="{ 'sound-bar--panel-root': isPanel }"
  >
    <div
      v-if="sounds.length > 0"
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
          <div class="sound-bar__playback-main">
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
                :disabled="panelPendulum"
                aria-label="Реверс"
                @update:model-value="setPanelReverse"
              >
                Реверс
              </Switch>
              <Switch
                :model-value="panelPendulum"
                aria-label="Маятник"
                @update:model-value="setPanelPendulum"
              >
                Маятник
              </Switch>
            </div>
            <div class="sound-bar__knobs-row">
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
            </div>
          </div>
        </div>
        <div class="sound-bar__scroll meet-scroll">
          <div class="sound-bar__emoji-grid">
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
              <span class="sound-bar__tile-emoji">{{ s.emoji }}</span>
              <div
                v-if="s.loopEnabled || s.gateEnabled"
                class="sound-bar__tile-badges"
              >
                <span v-if="s.loopEnabled" class="sound-bar__badge">L</span>
                <span v-if="s.gateEnabled" class="sound-bar__badge">G</span>
              </div>
            </Button>
          </div>
        </div>
      </div>
    </div>
    <div
      v-else-if="isPanel"
      class="sound-bar__surface sound-bar__surface--panel sound-bar__surface--empty"
      role="status"
      aria-label="Звуки организации"
    >
      <p class="sound-bar__empty-text">Нет звуков организации</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import type { Room as LiveKitRoom } from "livekit-client";

import { useOrganizationSounds, useSoundBarRoomChannel } from "../lib";
import type { OrganizationSound } from "../model/types";
import { Button, Knob, PixelIcon, Switch } from "@shared/ui";
import {
  soundBarVolume,
  soundBarMuted,
  setSoundBarVolume,
  toggleSoundBarMuted,
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
  }>(),
  { layout: "popover" },
);

const rootRef = ref<HTMLElement | null>(null);
const popoverOpen = ref(false);

const isPanel = computed(() => props.layout === "panel");

const { startAndBroadcast, stopAndBroadcast, sessionByEmoji } =
  useSoundBarRoomChannel(() => props.livekitRoom);
const { sounds } = useOrganizationSounds(() => props.orgId);

const previewMode = computed(() => props.previewMode ?? false);

const pressedEmoji = ref<string | null>(null);

const PANEL_STORAGE_V1 = "nonza_soundbar_playback_panel_v1";
const PANEL_STORAGE_KEY = "nonza_soundbar_playback_panel_v2";

type StoredPlayback = {
  loop: boolean;
  gate: boolean;
  reverse: boolean;
  pendulum: boolean;
  clipSpeed: number;
};

const DEFAULT_PLAYBACK: StoredPlayback = {
  loop: false,
  gate: false,
  reverse: false,
  pendulum: false,
  clipSpeed: 100,
};

const storePerSound = ref<Record<string, StoredPlayback>>({});
const selectedSoundId = ref<string | null>(null);
const legacyV1Panel = ref<StoredPlayback | null>(null);

const panelLoop = ref(false);
const panelGate = ref(false);
const panelReverse = ref(false);
const panelPendulum = ref(false);
const clipSpeedPct = ref(100);

const selectedSoundEmoji = computed(() => {
  const id = selectedSoundId.value;
  if (!id) return "";
  return sounds.value.find((s) => s.id === id)?.emoji ?? "";
});

function formatClipSpeed(v: number): string {
  return `${Math.round(v)}%`;
}

function setPanelLoop(v: boolean) {
  panelLoop.value = v;
}

function setPanelPendulum(v: boolean) {
  panelPendulum.value = v;
  if (v) {
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
    clipSpeed:
      typeof raw.clipSpeed === "number"
        ? clampSpeedPct(raw.clipSpeed)
        : DEFAULT_PLAYBACK.clipSpeed,
  };
}

function seedFromOrg(sound: OrganizationSound): StoredPlayback {
  return normalizePlaybackRow({
    loop: sound.loopEnabled,
    gate: sound.gateEnabled,
    reverse: false,
    pendulum: false,
    clipSpeed: sound.speed,
  });
}

function effectivePlaybackForSound(sound: OrganizationSound): StoredPlayback {
  const row = storePerSound.value[sound.id];
  if (row) return row;
  return seedFromOrg(sound);
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
  clipSpeedPct.value = s.clipSpeed;
}

function storedFromRefs(): StoredPlayback {
  return normalizePlaybackRow({
    loop: panelLoop.value,
    gate: panelGate.value,
    reverse: panelReverse.value,
    pendulum: panelPendulum.value,
    clipSpeed: clipSpeedPct.value,
  });
}

function playbackRowEquals(a: StoredPlayback, b: StoredPlayback): boolean {
  return (
    a.loop === b.loop &&
    a.gate === b.gate &&
    a.reverse === b.reverse &&
    a.pendulum === b.pendulum &&
    a.clipSpeed === b.clipSpeed
  );
}

function persistAll(): void {
  try {
    localStorage.setItem(
      PANEL_STORAGE_KEY,
      JSON.stringify({
        perSound: storePerSound.value,
        selectedId: selectedSoundId.value,
      }),
    );
  } catch {
    /* ignore */
  }
}

function loadPersisted(): void {
  try {
    const raw2 = localStorage.getItem(PANEL_STORAGE_KEY);
    if (raw2) {
      const j = JSON.parse(raw2) as {
        perSound?: Record<string, Record<string, unknown>>;
        selectedId?: string | null;
      };
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
      return;
    }
    const raw1 = localStorage.getItem(PANEL_STORAGE_V1);
    if (raw1) {
      const j = JSON.parse(raw1) as Record<string, unknown>;
      legacyV1Panel.value = normalizePlaybackRow(j);
    }
  } catch {
    /* ignore */
  }
}

function commitActiveSnapshot(): void {
  const id = selectedSoundId.value;
  if (id === null) return;
  const snap = storedFromRefs();
  const sound = sounds.value.find((s) => s.id === id);
  if (sound) {
    const seed = seedFromOrg(sound);
    if (playbackRowEquals(snap, seed)) {
      if (storePerSound.value[id]) {
        const { [id]: _drop, ...rest } = storePerSound.value;
        storePerSound.value = rest;
      }
      persistAll();
      return;
    }
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
  commitActiveSnapshot();
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
  const snap = effectivePlaybackForSound(sound);
  const volPct = Number.isFinite(sound.volume) ? sound.volume : 100;
  return {
    loopEnabled: snap.loop,
    gateEnabled: snap.gate,
    sessionVolume: Math.max(0, Math.min(1, volPct / 100)),
    playbackSpeed: Math.max(0.25, Math.min(4, snap.clipSpeed / 100)),
    reverse: snap.reverse && !snap.pendulum,
    pendulum: snap.pendulum,
  };
}

watch(sounds, (list) => {
  if (list.length === 0) {
    popoverOpen.value = false;
    commitActiveSnapshot();
    selectedSoundId.value = null;
    return;
  }
  ensureDefaultSoundSelection(list);
  hydrateRefsForSelection();
});

onMounted(() => {
  loadPersisted();
  const list = sounds.value;
  if (list.length === 0) {
    popoverOpen.value = false;
    commitActiveSnapshot();
    selectedSoundId.value = null;
    return;
  }
  ensureDefaultSoundSelection(list);
  hydrateRefsForSelection();
});

watch([panelLoop, panelGate, panelReverse, panelPendulum, clipSpeedPct], () => {
  commitActiveSnapshot();
});

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
});

function togglePopover() {
  popoverOpen.value = !popoverOpen.value;
}

function createSessionId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isActive(emoji: string): boolean {
  return Boolean(sessionByEmoji.value[emoji]);
}

function tileTitle(s: OrganizationSound): string {
  const bits: string[] = [];
  if (s.title?.trim()) bits.push(s.title.trim());
  if (storePerSound.value[s.id]) bits.push("свои настройки");
  if (s.loopEnabled) bits.push("L");
  if (s.gateEnabled) bits.push("G");
  bits.push("ЛКМ — выбор и звук · ПКМ — только выбор");
  return bits.join(" · ");
}

function tileVariant(s: OrganizationSound): "primary" | "default" {
  return isActive(s.emoji) ? "primary" : "default";
}

function handlePointerDown(sound: OrganizationSound, ev: PointerEvent) {
  if (previewMode.value) return;
  if (!sound.audioUrl) return;
  const cfg = broadcastPlaybackForSound(sound);
  if (!cfg.gateEnabled) return;
  if (ev.button !== 0) return;

  ev.preventDefault();
  selectProfile(sound);

  const existing = sessionByEmoji.value[sound.emoji];
  if (existing) {
    void stopAndBroadcast({ sessionId: existing });
  }

  const sessionId = createSessionId();
  sessionByEmoji.value = { ...sessionByEmoji.value, [sound.emoji]: sessionId };
  pressedEmoji.value = sound.emoji;

  void startAndBroadcast({
    sessionId,
    emoji: sound.emoji,
    audioUrl: sound.audioUrl,
    ...cfg,
  });
}

function handlePointerUp(sound: OrganizationSound) {
  if (previewMode.value) return;
  const cfg = broadcastPlaybackForSound(sound);
  if (!cfg.gateEnabled) return;

  const sessionId = sessionByEmoji.value[sound.emoji];
  if (!sessionId) return;

  void stopAndBroadcast({ sessionId });
  if (pressedEmoji.value === sound.emoji) pressedEmoji.value = null;
}

function handleRowClick(sound: OrganizationSound) {
  if (previewMode.value) return;
  if (!sound.audioUrl) return;
  selectProfile(sound);
  const cfg = broadcastPlaybackForSound(sound);
  if (cfg.gateEnabled) return;

  const existing = sessionByEmoji.value[sound.emoji];

  if (cfg.loopEnabled) {
    if (existing) {
      void stopAndBroadcast({ sessionId: existing });
      return;
    }

    const sessionId = createSessionId();
    sessionByEmoji.value = {
      ...sessionByEmoji.value,
      [sound.emoji]: sessionId,
    };
    void startAndBroadcast({
      sessionId,
      emoji: sound.emoji,
      audioUrl: sound.audioUrl,
      ...cfg,
    });
    return;
  }

  const sessionId = createSessionId();
  sessionByEmoji.value = { ...sessionByEmoji.value, [sound.emoji]: sessionId };
  void startAndBroadcast({
    sessionId,
    emoji: sound.emoji,
    audioUrl: sound.audioUrl,
    ...cfg,
    onLocalPlaybackEnded: () => {
      if (sessionByEmoji.value[sound.emoji] !== sessionId) return;
      const next = { ...sessionByEmoji.value };
      delete next[sound.emoji];
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
  position: static;
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

.sound-bar__playback-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  min-width: 0;
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
  align-items: flex-start;
  gap: 6px;
  min-width: 72px;
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
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 2px;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  line-height: 1;
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
</style>
