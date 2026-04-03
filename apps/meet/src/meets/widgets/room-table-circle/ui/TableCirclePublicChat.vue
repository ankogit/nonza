<template>
  <div class="public-chat">
    <div ref="listEl" class="public-chat__list meet-scroll">
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
        :style="{ '--participant-color': participantColorForIdentity(m.senderIdentity) }"
      >
        <div class="public-chat__msg-head">
          <span class="public-chat__msg-who">{{ resolveName(m.senderIdentity) }}</span>
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
            >{{ seg.label }}</a>
            <span v-else>{{ seg.value }}</span>
          </template>
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
import { computed, nextTick, ref, watch } from "vue";
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

const props = defineProps<{
  localParticipant: LocalParticipant | null;
  remoteParticipants: RemoteParticipant[];
  participantName: string;
  getDisplayName?: (p: RemoteParticipant | LocalParticipant) => string;
  livekitRoom: LiveKitRoom | null;
}>();

const draft = ref("");
const listEl = ref<HTMLElement | null>(null);

const { messages, canSend, send, maxMessageLength } = useTableCircleChat(
  () => props.localParticipant,
  () => props.livekitRoom,
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

function submit() {
  const t = draft.value.trim();
  if (!t) return;
  send(t);
  draft.value = "";
}

watch(
  () => messages.value.length,
  async () => {
    await nextTick();
    listEl.value?.lastElementChild?.scrollIntoView({ block: "end" });
  },
);
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

.public-chat__list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid #333;
  background: #111;
  padding: 10px;
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
  align-items: center;
  flex-shrink: 0;
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
  filter: drop-shadow(2px 2px 0px rgba(0, 0, 0, 0.25));
}

.public-chat__field::placeholder {
  color: #666;
  font-family: "Bebas Neue", sans-serif;
}

.public-chat__field:focus {
  border-color: #2980b9;
}

.public-chat__field:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.public-chat__send {
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .public-chat__field {
    height: 40px;
    padding: 4px 8px;
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .public-chat__field {
    height: 36px;
    padding: 4px 6px;
    font-size: 11px;
  }
}
</style>
