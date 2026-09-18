<template>
  <div class="public-chat">
    <div class="public-chat__list-wrap">
      <div class="public-chat__list-fade" aria-hidden="true" />
      <div ref="listEl" class="public-chat__list meet-scroll">
        <div class="public-chat__list-inner">
          <div
            v-if="messages.length === 0"
            class="public-chat__empty color-white-60"
          >
            Пока нет сообщений
          </div>
          <div
            v-for="m in messages"
            :key="m.id"
            class="public-chat__msg"
            :class="{ 'public-chat__msg--system': m.kind === 'system' }"
            :style="
              m.kind === 'system'
                ? undefined
                : {
                    '--participant-color': participantColorForIdentity(
                      m.senderIdentity,
                    ),
                  }
            "
          >
            <template v-if="m.kind === 'system'">
              <div class="public-chat__system">
                <span class="public-chat__system-rule" aria-hidden="true" />
                <span
                  class="public-chat__system-pill"
                  :class="{
                    'public-chat__system-pill--left':
                      systemPresentation(m).pillVariant === 'left',
                    'public-chat__system-pill--join':
                      systemPresentation(m).pillVariant === 'join',
                  }"
                  :style="{
                    '--participant-color': participantColorForIdentity(
                      m.senderIdentity,
                    ),
                  }"
                >
                  <span class="public-chat__system-dot" aria-hidden="true" />
                  <span class="public-chat__system-name">{{
                    displayName(m)
                  }}</span>
                  <span class="public-chat__system-action">{{
                    systemPresentation(m).actionLabel
                  }}</span>
                  <span class="public-chat__system-time">{{
                    formatTime(m.ts)
                  }}</span>
                </span>
                <span class="public-chat__system-rule" aria-hidden="true" />
              </div>
            </template>
            <template v-else>
              <div class="public-chat__msg-head">
                <span class="public-chat__msg-who">{{ displayName(m) }}</span>
                <span class="public-chat__msg-ts">{{ formatTs(m.ts) }}</span>
              </div>
              <div class="public-chat__msg-body">
                <template v-for="(seg, i) in segmentsFor(m.text)" :key="i">
                  <a
                    v-if="seg.type === 'link'"
                    class="public-chat__link"
                    :href="seg.href"
                    target="_blank"
                    rel="noopener noreferrer"
                    >{{ seg.label }}</a
                  >
                  <span v-else>{{ seg.value }}</span>
                </template>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div class="public-chat__composer">
      <input
        v-model="draft"
        type="text"
        class="public-chat__field"
        placeholder="Сообщение…"
        :maxlength="maxMessageLength"
        :disabled="!canSend"
        @keydown.enter.exact.prevent="submit"
      />
      <Button
        variant="default"
        class="public-chat__send"
        title="Отправить"
        :disabled="!canSend || !draft.trim()"
        @click="submit"
      >
        <PixelIcon name="message" variant="large" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import type {
  LocalParticipant,
  RemoteParticipant,
  Room as LiveKitRoom,
} from "livekit-client";
import {
  parseParticipantColorFromMetadata,
  splitTextByUrls,
  type TextLinkSegment,
} from "@shared/lib";
import { Button } from "@shared/ui";
import PixelIcon from "@shared/ui/PixelIcon/PixelIcon.vue";
import { useTableCircleChat } from "@features/table-circle";
import {
  getSystemEventPresentation,
  chatEntryDisplayName,
  tableCircleParticipantDisplayName,
  type TableCircleChatMessage,
} from "@features/table-circle";

const props = defineProps<{
  localParticipant: LocalParticipant | null;
  remoteParticipants: RemoteParticipant[];
  participantName: string;
  getDisplayName?: (p: RemoteParticipant | LocalParticipant) => string;
  livekitRoom: LiveKitRoom | null;
  roomId?: string | null;
  roomShortCode?: string | null;
}>();

const draft = ref("");
const listEl = ref<HTMLElement | null>(null);
const stickToBottom = ref(true);
let listResizeObserver: ResizeObserver | null = null;

const { messages, canSend, send, maxMessageLength } = useTableCircleChat(
  () => props.localParticipant,
  () => props.livekitRoom,
  {
    roomId: () => props.roomId,
    roomShortCode: () => props.roomShortCode,
    participantDisplayName: (p) =>
      tableCircleParticipantDisplayName(p, {
        localIdentity: props.localParticipant?.identity,
        participantName: props.participantName,
        getDisplayName: props.getDisplayName,
      }),
  },
);

const remoteById = computed(() => {
  const m = new Map<string, RemoteParticipant>();
  for (const p of props.remoteParticipants) m.set(p.identity, p);
  return m;
});

function resolveName(identity: string) {
  if (props.localParticipant?.identity === identity)
    return props.participantName;
  const p = remoteById.value.get(identity);
  if (!p) return identity;
  return props.getDisplayName?.(p) ?? p.name ?? p.identity;
}

function displayName(m: TableCircleChatMessage) {
  return chatEntryDisplayName(m, resolveName);
}

function participantColorForIdentity(identity: string): string {
  const name = resolveName(identity);
  const local = props.localParticipant;
  if (local?.identity === identity) {
    return parseParticipantColorFromMetadata(
      (local as { metadata?: string }).metadata,
      name,
    );
  }
  const remote = remoteById.value.get(identity);
  if (remote) {
    return parseParticipantColorFromMetadata(
      (remote as { metadata?: string }).metadata,
      name,
    );
  }
  return parseParticipantColorFromMetadata(undefined, name);
}

function segmentsFor(text: string): TextLinkSegment[] {
  return splitTextByUrls(text);
}

function formatTs(ts: number) {
  const d = new Date(ts);
  return `${d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
  })} ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function systemPresentation(m: TableCircleChatMessage) {
  if (m.kind === "system" && m.system) {
    return getSystemEventPresentation(m.system);
  }
  if (m.kind === "system") {
    if (/\sвышел\s*$/u.test(m.text)) {
      return { actionLabel: "вышел", pillVariant: "left" as const };
    }
    return { actionLabel: "зашёл", pillVariant: "join" as const };
  }
  return { actionLabel: "зашёл", pillVariant: "join" as const };
}

function submit() {
  const t = draft.value.trim();
  if (!t) return;
  send(t);
  draft.value = "";
  stickToBottom.value = true;
  void scrollToBottom();
}

function isNearBottom(el: HTMLElement, threshold = 72) {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

function onListScroll() {
  const el = listEl.value;
  if (!el) return;
  stickToBottom.value = isNearBottom(el);
}

async function scrollToBottom() {
  await nextTick();
  const el = listEl.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

watch(
  messages,
  async () => {
    if (!stickToBottom.value) return;
    await scrollToBottom();
  },
  { deep: true, flush: "post" },
);

onMounted(async () => {
  stickToBottom.value = true;
  await scrollToBottom();
  const el = listEl.value;
  if (!el) return;
  el.addEventListener("scroll", onListScroll, { passive: true });
  listResizeObserver = new ResizeObserver(() => {
    if (stickToBottom.value) void scrollToBottom();
  });
  listResizeObserver.observe(el);
});

onUnmounted(() => {
  listEl.value?.removeEventListener("scroll", onListScroll);
  listResizeObserver?.disconnect();
  listResizeObserver = null;
});
</script>

<style scoped>
.public-chat {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.public-chat__list-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.public-chat__list-fade {
  pointer-events: none;
  position: absolute;
  top: 1px;
  left: 1px;
  right: 1px;
  z-index: 2;
  height: 36px;
  background: linear-gradient(
    to bottom,
    #111 0%,
    rgba(17, 17, 17, 0.82) 42%,
    rgba(17, 17, 17, 0) 100%
  );
}

.public-chat__list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  border: 1px solid #333;
  background: #111;
  padding: 10px;
}

.public-chat__list-inner {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.public-chat__empty {
  text-align: center;
  padding: 16px 8px;
  font-size: 13px;
}

.public-chat__msg {
  --participant-color: #ccc;
  border: 1px solid #333;
  border-left: 3px solid var(--participant-color);
  background: #161616;
  padding: 8px 10px;
  contain: content;
}

.public-chat__msg--system {
  border: none;
  border-left: none;
  background: transparent;
  padding: 6px 0;
  contain: none;
}

.public-chat__system {
  display: grid;
  grid-template-columns: minmax(12px, 1fr) auto minmax(12px, 1fr);
  align-items: center;
  gap: 10px;
  width: 100%;
}

.public-chat__system-rule {
  height: 2px;
  background: repeating-linear-gradient(
    90deg,
    #3a3a3a 0 4px,
    transparent 4px 8px
  );
  opacity: 0.9;
}

.public-chat__system-pill {
  --participant-color: #bab1a8;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: min(100%, 280px);
  padding: 5px 10px;
  border: 2px solid #3a3a3a;
  background: #1a1a1a;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.35);
  box-sizing: border-box;
}

.public-chat__system-pill--join {
  border-bottom-color: var(--participant-color);
}

.public-chat__system-pill--left {
  opacity: 0.88;
}

.public-chat__system-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  background: var(--participant-color);
  box-shadow: 1px 1px 0 0 rgba(0, 0, 0, 0.35);
}

.public-chat__system-pill--left .public-chat__system-dot {
  background: #666;
}

.public-chat__system-name {
  color: var(--participant-color);
  font-family: "Bebas Neue", sans-serif;
  font-size: 14px;
  letter-spacing: 0.04em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

.public-chat__system-action {
  color: #8a827a;
  font-family: "Bebas Neue", sans-serif;
  font-size: 13px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  flex-shrink: 0;
}

.public-chat__system-time {
  color: #666;
  font-size: 11px;
  white-space: nowrap;
  flex-shrink: 0;
  margin-left: 2px;
}

.public-chat__msg-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
  font-size: 11px;
}

.public-chat__msg-who {
  color: var(--participant-color);
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.public-chat__msg-ts {
  color: #888;
  white-space: nowrap;
  flex-shrink: 0;
}

.public-chat__msg-body {
  color: #ddd;
  font-size: 13px;
  line-height: 1.45;
  word-break: break-word;
}

.public-chat__link {
  color: #7ec8ff;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.public-chat__composer {
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
  min-width: 0;
}

.public-chat__field {
  flex: 1;
  min-width: 0;
  height: 48px;
  padding: 6px 10px;
  border: 3px solid #444;
  border-right: none;
  border-radius: 0;
  appearance: none;
  -webkit-appearance: none;
  background: #1a1a1a;
  color: #bab1a8;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  font-family: "Bebas Neue", sans-serif;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.25);
}

.public-chat__field::placeholder {
  color: #666;
  font-family: "Bebas Neue", sans-serif;
}

.public-chat__field:focus {
  border-color: #2980b9;
  z-index: 1;
}

.public-chat__field:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.public-chat__send {
  flex-shrink: 0;
  width: 48px !important;
  height: 48px !important;
  min-width: 48px !important;
  min-height: 48px !important;
  box-sizing: border-box;
}

@media (max-width: 768px) {
  .public-chat__field {
    height: 44px;
    padding: 4px 8px;
    font-size: 16px;
  }

  .public-chat__send {
    width: 44px !important;
    height: 44px !important;
    min-width: 44px !important;
    min-height: 44px !important;
  }
}

@media (max-width: 480px) {
  .public-chat__field {
    height: 42px;
    padding: 4px 8px;
    font-size: 16px;
  }

  .public-chat__send {
    width: 42px !important;
    height: 42px !important;
    min-width: 42px !important;
    min-height: 42px !important;
  }
}
</style>
