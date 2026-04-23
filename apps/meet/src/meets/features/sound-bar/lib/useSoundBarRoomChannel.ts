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
import type {
  SoundBarActionMessage,
  SoundBarActionStartPayload,
} from "../model/types";

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

function clampSessionVolume(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(5, n));
}

function clampPlaybackSpeed(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 1;
  return Math.max(0.25, Math.min(4, n));
}

function clampPlaybackPitch(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 1;
  return Math.max(0.25, Math.min(4, n));
}

async function handleAction(
  payload: SoundBarActionMessage["payload"],
  opts?: { onPlaybackEnded?: () => void },
) {
  if (payload.action === "start") {
    const {
      emoji,
      sessionId,
      gateEnabled,
      loopEnabled,
      audioUrl,
      sessionVolume,
      playbackSpeed,
      playbackPitch,
      reverse,
      pendulum,
    } = payload;
    let clipLapSec = 2.5;

    await startSoundBarSession({
      sessionId,
      audioUrl,
      loopEnabled,
      gateEnabled,
      sessionVolume,
      playbackSpeed,
      playbackPitch,
      reverse,
      pendulum,
      onEnded: opts?.onPlaybackEnded,
      onGateNonLoopClipEnded:
        gateEnabled && !loopEnabled && !pendulum
          ? () => stopSoundBarEmojiGate(sessionId)
          : undefined,
      onPlaybackReady: ({ heardLapSec, heardTotalOnceSec }) => {
        clipLapSec = heardLapSec;
        if (gateEnabled) {
          startSoundBarEmojiGate(
            sessionId,
            emoji,
            loopEnabled ? heardLapSec : heardTotalOnceSec,
          );
        } else if (loopEnabled) {
          triggerSoundBarEmojiLoopIntro(emoji, heardLapSec, sessionId);
        } else {
          triggerSoundBarEmojiBurst(emoji, heardTotalOnceSec, sessionId);
        }
      },
      onLoopTick:
        loopEnabled && !gateEnabled
          ? () => triggerSoundBarEmojiLoopPulse(emoji, clipLapSec)
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

    const p = parsed.payload as Record<string, unknown> | undefined;

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

    const loopEnabled = Boolean(p.loopEnabled);
    const gateEnabled = Boolean(p.gateEnabled);
    const sessionVolume = clampSessionVolume(p.sessionVolume);
    const playbackSpeed = clampPlaybackSpeed(p.playbackSpeed);
    const playbackPitch =
      typeof p.playbackPitch === "number" ? clampPlaybackPitch(p.playbackPitch) : 1;
    const pendulum = typeof p.pendulum === "boolean" ? p.pendulum : false;
    let reverse = typeof p.reverse === "boolean" ? p.reverse : false;
    if (pendulum && !gateEnabled) {
      reverse = false;
    }

    if (p.action === "start") {
      sharedSessionByEmoji.value = {
        ...sharedSessionByEmoji.value,
        [emoji]: sessionId,
      };
    }

    const startPayload: SoundBarActionStartPayload | null =
      p.action === "start"
        ? {
            action: "start",
            sessionId,
            senderIdentity: p.senderIdentity as string,
            emoji,
            audioUrl,
            loopEnabled,
            gateEnabled,
            sessionVolume,
            playbackSpeed,
            playbackPitch,
            reverse,
            pendulum,
            ts: p.ts as number,
          }
        : null;

    void handleAction(
      p.action === "start" && startPayload
        ? startPayload
        : {
            action: "stop",
            sessionId,
            senderIdentity: p.senderIdentity as string,
            emoji: "",
            audioUrl: "",
            loopEnabled: false,
            gateEnabled: false,
            ts: p.ts as number,
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
  room.on(RoomEvent.Disconnected, stopAllKnownSessions);

  return () => {
    room.off(RoomEvent.DataReceived, handler);
    room.off(RoomEvent.Disconnected, stopAllKnownSessions);
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

export type SoundBarStartBroadcastParams = {
  sessionId: string;
  emoji: string;
  audioUrl: string;
  loopEnabled: boolean;
  gateEnabled: boolean;
  sessionVolume: number;
  playbackSpeed: number;
  playbackPitch: number;
  reverse: boolean;
  pendulum: boolean;
  onLocalPlaybackEnded?: () => void;
};

function stopAllKnownSessions(): void {
  for (const sessionId of Object.values(sharedSessionByEmoji.value)) {
    stopSoundBarEmojiGate(sessionId);
    stopSoundBarSession(sessionId);
  }
  sharedSessionByEmoji.value = {};
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
        stopAllKnownSessions();
        sharedSessionByEmoji.value = {};
        return;
      }
      releaseListener = acquireSoundBarRoomListener(room);
    },
    { immediate: true },
  );

  onUnmounted(() => {
    stopAllKnownSessions();
    releaseListener?.();
    releaseListener = null;
  });

  async function startAndBroadcast(params: SoundBarStartBroadcastParams) {
    const room = livekitRoom();
    const local = room?.localParticipant;
    if (!room || !local) return;

    const loopEnabled = params.loopEnabled;
    const pendulum = params.pendulum;

    const payload: SoundBarActionStartPayload = {
      action: "start",
      sessionId: params.sessionId,
      senderIdentity: local.identity,
      emoji: params.emoji,
      audioUrl: params.audioUrl,
      loopEnabled,
      gateEnabled: params.gateEnabled,
      sessionVolume: params.sessionVolume,
      playbackSpeed: params.playbackSpeed,
      playbackPitch: params.playbackPitch,
      reverse: params.reverse,
      pendulum,
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
