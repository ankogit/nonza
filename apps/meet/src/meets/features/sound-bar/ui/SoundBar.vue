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
        <div class="sound-bar__scroll meet-scroll">
          <div class="sound-bar__emoji-grid">
            <Button
              v-for="s in sounds"
              :key="s.id"
              type="icon"
              icon-size="40px"
              class="sound-bar__tile button--scale-disabled"
              :class="{ 'sound-bar__tile--pressed': pressedEmoji === s.emoji }"
              :variant="tileVariant(s)"
              :disabled="!s.audioUrl"
              :title="tileTitle(s)"
              @click="handleRowClick(s)"
              @pointerdown="handlePointerDown(s, $event)"
              @pointerup="handlePointerUp(s)"
              @pointerleave="handlePointerUp(s)"
              @pointercancel="handlePointerUp(s)"
              @contextmenu.prevent
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
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import type { Room as LiveKitRoom } from "livekit-client";

import { useOrganizationSounds, useSoundBarRoomChannel } from "../lib";
import type { OrganizationSound } from "../model/types";
import { Button, PixelIcon } from "@shared/ui";
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

watch(sounds, (list) => {
  if (list.length === 0) popoverOpen.value = false;
});

const pressedEmoji = ref<string | null>(null);

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
  if (s.loopEnabled) bits.push("loop");
  if (s.gateEnabled) bits.push("gate");
  return bits.length ? bits.join(" · ") : s.emoji;
}

function tileVariant(s: OrganizationSound): "primary" | "default" {
  return isActive(s.emoji) ? "primary" : "default";
}

function handlePointerDown(sound: OrganizationSound, ev: PointerEvent) {
  if (previewMode.value) return;
  if (!sound.audioUrl) return;
  if (!sound.gateEnabled) return;
  if (ev.button !== 0) return;

  ev.preventDefault();

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
    loopEnabled: sound.loopEnabled,
    gateEnabled: sound.gateEnabled,
  });
}

function handlePointerUp(sound: OrganizationSound) {
  if (previewMode.value) return;
  if (!sound.gateEnabled) return;

  const sessionId = sessionByEmoji.value[sound.emoji];
  if (!sessionId) return;

  void stopAndBroadcast({ sessionId });
  if (pressedEmoji.value === sound.emoji) pressedEmoji.value = null;
}

function handleRowClick(sound: OrganizationSound) {
  if (previewMode.value) return;
  if (!sound.audioUrl) return;
  if (sound.gateEnabled) return;

  const existing = sessionByEmoji.value[sound.emoji];

  if (sound.loopEnabled) {
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
      loopEnabled: true,
      gateEnabled: false,
    });
    return;
  }

  const sessionId = createSessionId();
  sessionByEmoji.value = { ...sessionByEmoji.value, [sound.emoji]: sessionId };
  void startAndBroadcast({
    sessionId,
    emoji: sound.emoji,
    audioUrl: sound.audioUrl,
    loopEnabled: false,
    gateEnabled: false,
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
  max-height: min(38vh, 280px);
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
  max-height: min(32vh, 220px);
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
