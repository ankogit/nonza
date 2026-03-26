<template>
  <div v-if="!previewMode" ref="rootRef" class="sound-bar">
    <div v-if="sounds.length > 0" class="sound-bar__anchor">
      <Button
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
        v-show="popoverOpen"
        class="sound-bar__popover"
        role="dialog"
        aria-label="Звуки"
        @click.stop
      >
        <div class="sound-bar__scroll">
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
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import type { Room as LiveKitRoom } from "livekit-client";

import { useOrganizationSounds, useSoundBarRoomChannel } from "../lib";
import type { OrganizationSound } from "../model/types";
import { Button, PixelIcon } from "@shared/ui";

const props = defineProps<{
  orgId: string | null;
  livekitRoom: LiveKitRoom | null;
  previewMode?: boolean;
}>();

const rootRef = ref<HTMLElement | null>(null);
const popoverOpen = ref(false);

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
  if (!open) return;
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

.sound-bar__anchor {
  position: relative;
  display: flex;
  align-items: center;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.sound-bar__popover {
  position: absolute;
  bottom: calc(100% + 10px);
  right: 0;
  z-index: 10020;

  min-width: min(160px, 85vw);
  max-width: min(280px, 92vw);
  padding: 10px 12px;

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

.sound-bar__scroll {
  max-height: min(50vh, 420px);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  margin: 0 -4px;
  padding: 0 4px;
}

.sound-bar__scroll::-webkit-scrollbar {
  width: 8px;
}

.sound-bar__scroll::-webkit-scrollbar-track {
  background: #111;
}

.sound-bar__scroll::-webkit-scrollbar-thumb {
  background: #444;
  border: 1px solid #2a2a2a;
}

.sound-bar__emoji-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  justify-items: center;
  width: 100%;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

:deep(.sound-bar__tile.button) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 3px 2px 4px;
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
