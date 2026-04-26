<template>
  <div
    class="org-soundbar-page"
    :class="{ 'org-soundbar-page--embed': variant === 'embed' }"
  >
    <section class="org-soundbar-page__section">
      <h4 class="org-soundbar-page__sub">Редактор звука</h4>
      <SoundBarEditorPanel
        v-if="canEdit"
        :org-id="orgId"
        :session-key="editorSessionKey"
        :initial-emoji="editorInitialEmoji"
        :initial-title="editorInitialTitle"
        :initial-loop-enabled="editorInitialLoopEnabled"
        :initial-gate-enabled="editorInitialGateEnabled"
        :initial-volume="editorInitialVolume"
        :initial-speed="editorInitialSpeed"
        :initial-audio-url="editorInitialAudioUrl"
        @saved="onEditorSaved"
      />
      <p v-else class="org-soundbar-page__hint">
        Настраивать саунд-бар может владелец или администратор организации.
      </p>
    </section>

    <section class="org-soundbar-page__section">
      <h4 class="org-soundbar-page__sub">Звуки организации</h4>
      <div v-if="soundsLoading" class="org-soundbar-page__skeleton">
        <Skeleton variant="rect" :height="56" />
      </div>
      <div v-else-if="sounds.length === 0" class="org-soundbar-page__empty">
        Пока нет сохранённых звуков.
      </div>
      <ul v-else class="org-soundbar-page__list">
        <li v-for="s in sounds" :key="s.id" class="org-soundbar-page__row">
          <span class="org-soundbar-page__emoji" :title="s.title || s.emoji">{{
            s.emoji
          }}</span>
          <div class="org-soundbar-page__meta">
            <span class="org-soundbar-page__name">{{ s.title || "—" }}</span>
            <span class="org-soundbar-page__ver">v{{ s.version }}</span>
          </div>
          <div class="org-soundbar-page__flags">
            <span v-if="s.loopEnabled" class="org-soundbar-page__badge"
              >LOOP</span
            >
            <span v-if="s.gateEnabled" class="org-soundbar-page__badge"
              >GATE</span
            >
          </div>
          <div class="org-soundbar-page__row-actions">
            <Button
              v-if="canEdit"
              variant="danger"
              size="tiny"
              :disabled="deletingId === s.id"
              @click="confirmDelete(s)"
            >
              <PixelIcon name="delete" variant="small" />
            </Button>
            <Button
              type="icon"
              size="tiny"
              :class="{
                'org-soundbar-page__play--active': isListActive(s.emoji),
                'org-soundbar-page__play--pressed': pressedEmoji === s.emoji,
              }"
              :disabled="!s.audioUrl"
              @pointerdown="onListPointerDown(s, $event)"
              @pointerup="onListPointerUp(s)"
              @pointerleave="onListPointerUp(s)"
              @pointercancel="onListPointerUp(s)"
              @click="onListClick(s)"
            >
              <PixelIcon
                :name="s.gateEnabled ? 'play-hold' : 'play'"
                :size="24"
              />
            </Button>
            <Button
              v-if="canEdit"
              variant="primary"
              size="tiny"
              :disabled="soundsLoading"
              @click="loadSoundForEdit(s)"
            >
              <PixelIcon name="edit" variant="small" />
            </Button>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

import SoundBarEditorPanel from "./SoundBarEditorPanel.vue";
import { useOrganizationSounds, notifyOrganizationSoundsChanged } from "../lib";
import type { OrganizationSound } from "../model/types";
import { Button, PixelIcon, Skeleton } from "@shared/ui";
import {
  showToast,
  startSoundBarSession,
  stopSoundBarSession,
} from "@shared/lib";

const props = withDefaults(
  defineProps<{
    orgId: string;
    canEdit: boolean;
    variant?: "page" | "embed";
  }>(),
  { variant: "page" },
);

const editorSessionKey = ref(0);
const editorInitialEmoji = ref<string | null>(null);
const editorInitialTitle = ref<string | null>(null);
const editorInitialLoopEnabled = ref(false);
const editorInitialGateEnabled = ref(false);
const editorInitialVolume = ref(100);
const editorInitialSpeed = ref(100);
const editorInitialAudioUrl = ref<string | null>(null);

const { sounds, isLoading, deleteSound } = useOrganizationSounds(
  () => props.orgId,
);
const soundsLoading = isLoading;
const deletingId = ref<string | null>(null);
const pressedEmoji = ref<string | null>(null);
const sessionByEmoji = ref<Record<string, string[]>>({});

function createSessionId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isListActive(emoji: string): boolean {
  return (sessionByEmoji.value[emoji]?.length ?? 0) > 0;
}

function loadSoundForEdit(s: OrganizationSound) {
  editorInitialEmoji.value = s.emoji;
  editorInitialTitle.value = s.title || null;
  editorInitialLoopEnabled.value = s.loopEnabled;
  editorInitialGateEnabled.value = s.gateEnabled;
  editorInitialVolume.value = s.volume;
  editorInitialSpeed.value = s.speed;
  editorInitialAudioUrl.value = s.audioUrl?.trim() || null;
  editorSessionKey.value += 1;
}

function onEditorSaved() {
  notifyOrganizationSoundsChanged(props.orgId);
}

async function confirmDelete(s: OrganizationSound) {
  if (!props.canEdit) return;
  if (!window.confirm(`Удалить звук «${s.emoji}»?`)) return;
  deletingId.value = s.id;
  try {
    await deleteSound(s.id);
    showToast("Звук удалён", { variant: "success" });
  } finally {
    deletingId.value = null;
  }
}

function onListPointerDown(s: OrganizationSound, ev: PointerEvent) {
  if (!s.audioUrl) return;
  if (!s.gateEnabled) return;
  ev.preventDefault();
  const existingIds = sessionByEmoji.value[s.emoji] ?? [];
  for (const id of existingIds) {
    stopSoundBarSession(id);
  }
  const sessionId = createSessionId();
  sessionByEmoji.value = {
    ...sessionByEmoji.value,
    [s.emoji]: [sessionId],
  };
  pressedEmoji.value = s.emoji;
  void startSoundBarSession({
    sessionId,
    audioUrl: s.audioUrl,
    audioVersion: s.version,
    loopEnabled: s.loopEnabled,
    gateEnabled: s.gateEnabled,
    sessionVolume: Math.max(0, Math.min(5, Number(s.volume) / 100)),
    playbackSpeed: Math.max(0.25, Math.min(4, Number(s.speed) / 100)),
    playbackPitch: 1,
    fx: {
      filterHz: 20000,
      distortion: 0,
      delayWet: 0,
      delayTimeMs: 200,
      reverbWet: 0,
      reverbDecayMs: 1200,
      eqLowDb: 0,
      eqMidDb: 0,
      eqHighDb: 0,
      compressorThresholdDb: -24,
      compressorRatio: 1,
      compressorAttackMs: 10,
      compressorReleaseMs: 250,
      envelopeAttackMs: 0,
      envelopeReleaseMs: 0,
    },
    reverse: false,
    pendulum: false,
  });
}

function onListPointerUp(s: OrganizationSound) {
  if (!s.gateEnabled) return;
  const ids = sessionByEmoji.value[s.emoji] ?? [];
  const sessionId = ids[ids.length - 1];
  if (!sessionId) return;
  stopSoundBarSession(sessionId);
  const filtered = ids.filter((id) => id !== sessionId);
  const next = { ...sessionByEmoji.value };
  if (filtered.length === 0) delete next[s.emoji];
  else next[s.emoji] = filtered;
  sessionByEmoji.value = next;
  if (pressedEmoji.value === s.emoji) pressedEmoji.value = null;
}

function onListClick(s: OrganizationSound) {
  if (!s.audioUrl) return;
  if (s.gateEnabled) return;
  const existingIds = sessionByEmoji.value[s.emoji] ?? [];
  if (s.loopEnabled) {
    if (existingIds.length > 0) {
      for (const id of existingIds) {
        stopSoundBarSession(id);
      }
      const next = { ...sessionByEmoji.value };
      delete next[s.emoji];
      sessionByEmoji.value = next;
      return;
    }
    const sessionId = createSessionId();
    sessionByEmoji.value = {
      ...sessionByEmoji.value,
      [s.emoji]: [sessionId],
    };
    void startSoundBarSession({
      sessionId,
      audioUrl: s.audioUrl,
      audioVersion: s.version,
      loopEnabled: true,
      gateEnabled: false,
      sessionVolume: Math.max(0, Math.min(5, Number(s.volume) / 100)),
      playbackSpeed: Math.max(0.25, Math.min(4, Number(s.speed) / 100)),
      playbackPitch: 1,
      fx: {
        filterHz: 20000,
        distortion: 0,
        delayWet: 0,
        delayTimeMs: 200,
        reverbWet: 0,
        reverbDecayMs: 1200,
        eqLowDb: 0,
        eqMidDb: 0,
        eqHighDb: 0,
        compressorThresholdDb: -24,
        compressorRatio: 1,
        compressorAttackMs: 10,
        compressorReleaseMs: 250,
        envelopeAttackMs: 0,
        envelopeReleaseMs: 0,
      },
      reverse: false,
      pendulum: false,
    });
    return;
  }
  const sessionId = createSessionId();
  const cur = sessionByEmoji.value[s.emoji] ?? [];
  sessionByEmoji.value = {
    ...sessionByEmoji.value,
    [s.emoji]: [...cur, sessionId],
  };
  void startSoundBarSession({
    sessionId,
    audioUrl: s.audioUrl,
    audioVersion: s.version,
    loopEnabled: false,
    gateEnabled: false,
    sessionVolume: Math.max(0, Math.min(5, Number(s.volume) / 100)),
    playbackSpeed: Math.max(0.25, Math.min(4, Number(s.speed) / 100)),
    playbackPitch: 1,
    fx: {
      filterHz: 20000,
      distortion: 0,
      delayWet: 0,
      delayTimeMs: 200,
      reverbWet: 0,
      reverbDecayMs: 1200,
      eqLowDb: 0,
      eqMidDb: 0,
      eqHighDb: 0,
      compressorThresholdDb: -24,
      compressorRatio: 1,
      compressorAttackMs: 10,
      compressorReleaseMs: 250,
      envelopeAttackMs: 0,
      envelopeReleaseMs: 0,
    },
    reverse: false,
    pendulum: false,
    onEnded: () => {
      const list = sessionByEmoji.value[s.emoji] ?? [];
      if (!list.includes(sessionId)) return;
      const filtered = list.filter((id) => id !== sessionId);
      const next = { ...sessionByEmoji.value };
      if (filtered.length === 0) delete next[s.emoji];
      else next[s.emoji] = filtered;
      sessionByEmoji.value = next;
    },
  });
}
</script>

<style scoped>
.org-soundbar-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.org-soundbar-page--embed {
  gap: 14px;
}

.org-soundbar-page__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.org-soundbar-page--embed .org-soundbar-page__section {
  gap: 8px;
}

.org-soundbar-page__sub {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #bab1a8;
}

.org-soundbar-page--embed .org-soundbar-page__sub {
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(186, 177, 168, 0.88);
}

.org-soundbar-page__hint {
  margin: 0;
  color: #888;
  font-size: 14px;
}

.org-soundbar-page--embed .org-soundbar-page__hint {
  font-size: 11px;
  line-height: 1.45;
}

.org-soundbar-page__empty {
  color: #888;
  font-size: 14px;
}

.org-soundbar-page--embed .org-soundbar-page__empty {
  font-size: 11px;
}

.org-soundbar-page__skeleton {
  max-width: 400px;
}

.org-soundbar-page--embed .org-soundbar-page__skeleton {
  max-width: none;
}

.org-soundbar-page__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.org-soundbar-page--embed .org-soundbar-page__list {
  gap: 6px;
}

.org-soundbar-page__row {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  border: 3px solid #333;
  border-top-color: #444;
  border-left-color: #444;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.35);
}

.org-soundbar-page--embed .org-soundbar-page__row {
  gap: 8px;
  padding: 7px 9px;
  border-width: 2px;
  box-shadow: 1px 1px 0 rgba(0, 0, 0, 0.35);
}

@media (max-width: 720px) {
  .org-soundbar-page__row {
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
  }

  .org-soundbar-page__flags {
    grid-column: 1 / -1;
  }

  .org-soundbar-page__row-actions {
    grid-column: 1 / -1;
    flex-wrap: wrap;
  }
}

.org-soundbar-page__emoji {
  font-size: 26px;
  line-height: 1;
  width: 36px;
  text-align: center;
}

.org-soundbar-page--embed .org-soundbar-page__emoji {
  font-size: 20px;
  width: 28px;
}

.org-soundbar-page__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.org-soundbar-page__name {
  color: #e8e4dc;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.org-soundbar-page--embed .org-soundbar-page__name {
  font-size: 12px;
}

.org-soundbar-page__ver {
  color: #666;
  font-size: 12px;
}

.org-soundbar-page--embed .org-soundbar-page__ver {
  font-size: 10px;
}

.org-soundbar-page__flags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.org-soundbar-page__badge {
  padding: 2px 6px;
  border: 2px solid #333;
  font-size: 10px;
  color: #bab1a8;
}

.org-soundbar-page--embed .org-soundbar-page__badge {
  padding: 1px 4px;
  font-size: 8px;
  border-width: 1px;
}

.org-soundbar-page__row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.org-soundbar-page--embed .org-soundbar-page__row-actions {
  gap: 5px;
}

.org-soundbar-page__row-actions :deep(.org-soundbar-page__play) {
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  padding: 0;
  border-color: #ffffff10;
  border-top-color: #ffffff20;
  border-left-color: #ffffff20;
  background: #457fb3;
  filter: none;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.25);
}

.org-soundbar-page--embed .org-soundbar-page__row-actions :deep(.org-soundbar-page__play) {
  width: 30px;
  height: 30px;
  min-width: 30px;
  min-height: 30px;
}

.org-soundbar-page__row-actions
  :deep(.org-soundbar-page__play:hover:not(.button--disabled)) {
  background: #5a8fc4;
  scale: 1;
}

.org-soundbar-page__row-actions
  :deep(.org-soundbar-page__play.button--disabled) {
  opacity: 0.45;
  cursor: not-allowed;
}

.org-soundbar-page__row-actions
  :deep(.org-soundbar-page__play.org-soundbar-page__play--active) {
  background: #2980b9;
}

.org-soundbar-page__row-actions
  :deep(.org-soundbar-page__play.org-soundbar-page__play--pressed) {
  background: #3a6a9a;
}

.org-soundbar-page--embed :deep(.soundbar-editor-panel) {
  font-size: 11px;
}
</style>
