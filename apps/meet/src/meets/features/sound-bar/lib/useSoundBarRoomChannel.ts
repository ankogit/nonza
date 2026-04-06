import { onUnmounted, ref, watch } from "vue";
import type {
  LocalParticipant,
  RemoteParticipant,
  Room as LiveKitRoom,
} from "livekit-client";
import { RoomEvent } from "livekit-client";
import {
  startSoundBarSession,
  stopSoundBarSession,
  startSoundBarEmojiGate,
  stopSoundBarEmojiGate,
  triggerSoundBarEmojiBurst,
  triggerSoundBarEmojiLoopIntro,
  triggerSoundBarEmojiLoopPulse,
} from "@shared/lib";
import type { SoundBarActionMessage } from "../model/types";

const DATA_TOPIC = "sound_bar";

const sharedSessionByEmoji = ref<Record<string, string>>({});

const roomListenerBuckets = new WeakMap<
  LiveKitRoom,
  { count: number; detach: (() => void) | null }
>();

function safeParse(payload: Uint8Array): unknown {
  const raw = new TextDecoder().decode(payload);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function removeSessionBySessionId(sessionId: string) {
  const next = { ...sharedSessionByEmoji.value };
  let changed = false;
  for (const [emoji, id] of Object.entries(next)) {
    if (id === sessionId) {
      delete next[emoji];
      changed = true;
    }
  }
  if (changed) sharedSessionByEmoji.value = next;
}

async function handleAction(
  payload: SoundBarActionMessage["payload"],
  opts?: { onPlaybackEnded?: () => void },
) {
  if (payload.action === "start") {
    const { emoji, sessionId, gateEnabled, loopEnabled } = payload;
    let clipDurationSec = 2.5;

    await startSoundBarSession({
      sessionId,
      audioUrl: payload.audioUrl,
      loopEnabled,
      onEnded: opts?.onPlaybackEnded,
      onGateNonLoopClipEnded:
        gateEnabled && !loopEnabled
          ? () => stopSoundBarEmojiGate(sessionId)
          : undefined,
      onPlaybackReady: ({ durationSec }) => {
        clipDurationSec = durationSec;
        if (gateEnabled) {
          startSoundBarEmojiGate(sessionId, emoji, durationSec);
        } else if (loopEnabled) {
          triggerSoundBarEmojiLoopIntro(emoji, durationSec);
        } else {
          triggerSoundBarEmojiBurst(emoji, durationSec);
        }
      },
      onLoopTick:
        loopEnabled && !gateEnabled
          ? () => triggerSoundBarEmojiLoopPulse(emoji, clipDurationSec)
          : undefined,
    });
    return;
  }

  if (payload.action === "stop") {
    stopSoundBarEmojiGate(payload.sessionId);
    stopSoundBarSession(payload.sessionId);
    removeSessionBySessionId(payload.sessionId);
  }
}

function attachRoomDataListener(room: LiveKitRoom): () => void {
  const handler = async (
    payload: Uint8Array,
    participant?: RemoteParticipant | LocalParticipant,
    _kind?: unknown,
    topic?: string,
  ) => {
    if (topic != null && topic !== DATA_TOPIC) return;
    if (!participant) return;

    const local = room.localParticipant;
    if (participant.identity === local.identity) return;

    const parsed = safeParse(payload) as Partial<SoundBarActionMessage> | null;
    if (
      !parsed?.type ||
      parsed.type !== "sound_bar_action" ||
      !parsed.payload
    ) {
      return;
    }

    const p = parsed.payload as
      | Partial<SoundBarActionMessage["payload"]>
      | undefined;

    if (!p?.action || (p.action !== "start" && p.action !== "stop")) return;
    if (!p?.sessionId || typeof p.sessionId !== "string") return;
    if (typeof p.senderIdentity !== "string") return;
    if (typeof p.emoji !== "string") return;
    if (p.action === "start" && !p.emoji) return;
    if (typeof p.ts !== "number") return;
    if (typeof p.loopEnabled !== "boolean") return;
    if (typeof p.gateEnabled !== "boolean") return;
    if (p.action === "start") {
      if (!p?.audioUrl || typeof p.audioUrl !== "string") return;
    }

    const audioUrl = p.action === "start" ? (p.audioUrl as string) : "";

    const emoji = p.emoji as string;
    const sessionId = p.sessionId;

    if (p.action === "start") {
      sharedSessionByEmoji.value = {
        ...sharedSessionByEmoji.value,
        [emoji]: sessionId,
      };
    }

    void handleAction(
      {
        action: p.action,
        sessionId,
        senderIdentity: p.senderIdentity,
        emoji,
        audioUrl,
        loopEnabled: p.loopEnabled,
        gateEnabled: p.gateEnabled,
        ts: p.ts,
      },
      p.action === "start"
        ? {
            onPlaybackEnded: () => {
              if (sharedSessionByEmoji.value[emoji] !== sessionId) return;
              const next = { ...sharedSessionByEmoji.value };
              delete next[emoji];
              sharedSessionByEmoji.value = next;
            },
          }
        : undefined,
    ).catch(() => {});
  };

  room.on(RoomEvent.DataReceived, handler);

  return () => {
    room.off(RoomEvent.DataReceived, handler);
  };
}

function acquireSoundBarRoomListener(room: LiveKitRoom): () => void {
  let bucket = roomListenerBuckets.get(room);
  if (!bucket) {
    bucket = { count: 0, detach: null };
    roomListenerBuckets.set(room, bucket);
  }
  bucket.count++;
  if (bucket.count === 1) {
    bucket.detach = attachRoomDataListener(room);
  }
  return () => {
    const b = roomListenerBuckets.get(room);
    if (!b) return;
    b.count--;
    if (b.count <= 0) {
      b.detach?.();
      b.detach = null;
      roomListenerBuckets.delete(room);
    }
  };
}

export function useSoundBarRoomChannel(livekitRoom: () => LiveKitRoom | null) {
  let releaseListener: (() => void) | null = null;

  async function publishAction(payload: SoundBarActionMessage["payload"]) {
    const room = livekitRoom();
    const local = room?.localParticipant;
    if (!room || !local) return;

    const next: SoundBarActionMessage = {
      type: "sound_bar_action",
      payload,
    };

    const encoded = new TextEncoder().encode(JSON.stringify(next));

    local
      .publishData(encoded, {
        reliable: true,
        topic: DATA_TOPIC,
      })
      .catch(() => {});
  }

  watch(
    livekitRoom,
    (room) => {
      releaseListener?.();
      releaseListener = null;
      if (!room) {
        sharedSessionByEmoji.value = {};
        return;
      }
      releaseListener = acquireSoundBarRoomListener(room);
    },
    { immediate: true },
  );

  onUnmounted(() => {
    releaseListener?.();
    releaseListener = null;
  });

  async function startAndBroadcast(params: {
    sessionId: string;
    emoji: string;
    audioUrl: string;
    loopEnabled: boolean;
    gateEnabled: boolean;
    onLocalPlaybackEnded?: () => void;
  }) {
    const room = livekitRoom();
    const local = room?.localParticipant;
    if (!room || !local) return;

    const payload: SoundBarActionMessage["payload"] = {
      action: "start",
      sessionId: params.sessionId,
      senderIdentity: local.identity,
      emoji: params.emoji,
      audioUrl: params.audioUrl,
      loopEnabled: params.loopEnabled,
      gateEnabled: params.gateEnabled,
      ts: Date.now(),
    };

    void handleAction(payload, {
      onPlaybackEnded: params.onLocalPlaybackEnded,
    }).catch(() => {});
    void publishAction(payload).catch(() => {});
  }

  async function stopAndBroadcast(params: { sessionId: string }) {
    const room = livekitRoom();
    const local = room?.localParticipant;
    if (!room || !local) return;

    const payload: SoundBarActionMessage["payload"] = {
      action: "stop",
      sessionId: params.sessionId,
      senderIdentity: local.identity,
      emoji: "",
      audioUrl: "",
      loopEnabled: false,
      gateEnabled: false,
      ts: Date.now(),
    };

    void handleAction(payload).catch(() => {});
    void publishAction(payload).catch(() => {});
  }

  return {
    startAndBroadcast,
    stopAndBroadcast,
    sessionByEmoji: sharedSessionByEmoji,
    dataTopic: DATA_TOPIC,
  };
}
