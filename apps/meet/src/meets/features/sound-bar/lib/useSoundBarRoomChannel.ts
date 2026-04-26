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
  SoundBarFxSettings,
} from "../model/types";

const DATA_TOPIC = "sound_bar";
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
  console.debug(`[soundbar/channel] ${event}`, payload ?? "");
}

const sharedSessionByEmoji = ref<Record<string, string[]>>({});

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
  for (const [emoji, ids] of Object.entries(next)) {
    const list = Array.isArray(ids) ? ids : [];
    const filtered = list.filter((id) => id !== sessionId);
    if (filtered.length !== list.length) {
      changed = true;
      if (filtered.length === 0) delete next[emoji];
      else next[emoji] = filtered;
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

function clampFxPercent(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clampFxFilterHz(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 20000;
  return Math.max(200, Math.min(20000, Math.round(n)));
}

function clampDelayTimeMs(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 200;
  return Math.max(10, Math.min(2000, Math.round(n)));
}

function clampReverbDecayMs(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 1200;
  return Math.max(100, Math.min(6000, Math.round(n)));
}

function clampEqDb(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(-24, Math.min(24, Math.round(n)));
}

function clampCompressorAttackMs(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 10;
  return Math.max(1, Math.min(200, Math.round(n)));
}

function clampCompressorThresholdDb(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return -24;
  return Math.max(-48, Math.min(0, Math.round(n)));
}

function clampCompressorRatio(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(20, Math.round(n * 2) / 2));
}

function clampCompressorReleaseMs(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 250;
  return Math.max(50, Math.min(800, Math.round(n)));
}

function clampEnvelopeAttackMs(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(500, Math.round(n)));
}

function clampEnvelopeReleaseMs(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(800, Math.round(n)));
}

function parseFx(raw: unknown): SoundBarFxSettings {
  const fx = raw as Record<string, unknown> | null;
  return {
    filterHz: clampFxFilterHz(fx?.filterHz),
    distortion: clampFxPercent(fx?.distortion),
    delayWet: clampFxPercent(fx?.delayWet),
    delayTimeMs: clampDelayTimeMs(fx?.delayTimeMs),
    reverbWet: clampFxPercent(fx?.reverbWet),
    reverbDecayMs: clampReverbDecayMs(fx?.reverbDecayMs),
    eqLowDb: clampEqDb(fx?.eqLowDb),
    eqMidDb: clampEqDb(fx?.eqMidDb),
    eqHighDb: clampEqDb(fx?.eqHighDb),
    compressorThresholdDb: (() => {
      if (typeof fx?.compressorThresholdDb === "number") {
        return clampCompressorThresholdDb(fx.compressorThresholdDb);
      }
      const amt = fx?.compressorAmount;
      if (typeof amt === "number" && Number.isFinite(amt) && amt > 0) {
        const a = Math.max(0, Math.min(100, Math.round(amt)));
        return clampCompressorThresholdDb(-18 - (a / 100) * 24);
      }
      return clampCompressorThresholdDb(undefined);
    })(),
    compressorRatio: (() => {
      if (typeof fx?.compressorRatio === "number") {
        return clampCompressorRatio(fx.compressorRatio);
      }
      const amt = fx?.compressorAmount;
      if (typeof amt === "number" && Number.isFinite(amt) && amt > 0) {
        const a = Math.max(0, Math.min(100, Math.round(amt)));
        return clampCompressorRatio(2 + (a / 100) * 10);
      }
      return clampCompressorRatio(undefined);
    })(),
    compressorAttackMs: clampCompressorAttackMs(fx?.compressorAttackMs),
    compressorReleaseMs: clampCompressorReleaseMs(fx?.compressorReleaseMs),
    envelopeAttackMs: clampEnvelopeAttackMs(fx?.envelopeAttackMs),
    envelopeReleaseMs: clampEnvelopeReleaseMs(fx?.envelopeReleaseMs),
  };
}

async function handleAction(
  payload: SoundBarActionMessage["payload"],
  opts?: {
    onPlaybackEnded?: () => void;
    syncOrigin?: "local" | "remote";
    receivedAtMs?: number;
  },
) {
  if (payload.action === "start") {
    debugLog("handleAction:start", {
      sessionId: payload.sessionId,
      emoji: payload.emoji,
      gateEnabled: payload.gateEnabled,
      loopEnabled: payload.loopEnabled,
      reverse: payload.reverse,
      pendulum: payload.pendulum,
      playbackSpeed: payload.playbackSpeed,
      playbackPitch: payload.playbackPitch,
      fx: payload.fx,
    });
    const {
      emoji,
      sessionId,
      gateEnabled,
      loopEnabled,
      audioUrl,
      sessionVolume,
      playbackSpeed,
      playbackPitch,
      fx,
      reverse,
      pendulum,
    } = payload;
    let clipLapSec = 2.5;

    await startSoundBarSession({
      sessionId,
      audioUrl,
      audioVersion: payload.audioVersion,
      loopEnabled,
      gateEnabled,
      sessionVolume,
      playbackSpeed,
      playbackPitch,
      fx,
      reverse,
      pendulum,
      syncOrigin: opts?.syncOrigin ?? "local",
      senderTsMs: payload.ts,
      receivedAtMs: opts?.receivedAtMs ?? payload.ts,
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
          ? () => triggerSoundBarEmojiLoopPulse(emoji, clipLapSec, sessionId)
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
    const fx = parseFx(p.fx);
    const pendulum = typeof p.pendulum === "boolean" ? p.pendulum : false;
    let reverse = typeof p.reverse === "boolean" ? p.reverse : false;
    if (pendulum && !gateEnabled) {
      reverse = false;
    }

    if (p.action === "start") {
      const cur = sharedSessionByEmoji.value[emoji] ?? [];
      sharedSessionByEmoji.value = {
        ...sharedSessionByEmoji.value,
        [emoji]: [...cur, sessionId],
      };
    }

    const receivedAtMs = Date.now();
    const audioVersionParsed =
      typeof p.audioVersion === "number" && Number.isFinite(p.audioVersion)
        ? Math.floor(p.audioVersion)
        : 0;
    const startPayload: SoundBarActionStartPayload | null =
      p.action === "start"
        ? {
            action: "start",
            sessionId,
            senderIdentity: p.senderIdentity as string,
            emoji,
            audioUrl,
            audioVersion: audioVersionParsed,
            loopEnabled,
            gateEnabled,
            sessionVolume,
            playbackSpeed,
            playbackPitch,
            fx,
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
              const list = sharedSessionByEmoji.value[emoji] ?? [];
              if (!list.includes(sessionId)) return;
              const filtered = list.filter((id) => id !== sessionId);
              const next = { ...sharedSessionByEmoji.value };
              if (filtered.length === 0) delete next[emoji];
              else next[emoji] = filtered;
              sharedSessionByEmoji.value = next;
            },
            syncOrigin: "remote",
            receivedAtMs,
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
  audioVersion: number;
  loopEnabled: boolean;
  gateEnabled: boolean;
  sessionVolume: number;
  playbackSpeed: number;
  playbackPitch: number;
  fx: SoundBarFxSettings;
  reverse: boolean;
  pendulum: boolean;
  onLocalPlaybackEnded?: () => void;
};

function stopAllKnownSessions(): void {
  for (const sessionId of Object.values(sharedSessionByEmoji.value).flat()) {
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

    const ts = Date.now();
    const payload: SoundBarActionStartPayload = {
      action: "start",
      sessionId: params.sessionId,
      senderIdentity: local.identity,
      emoji: params.emoji,
      audioUrl: params.audioUrl,
      audioVersion: params.audioVersion,
      loopEnabled,
      gateEnabled: params.gateEnabled,
      sessionVolume: params.sessionVolume,
      playbackSpeed: params.playbackSpeed,
      playbackPitch: params.playbackPitch,
      fx: params.fx,
      reverse: params.reverse,
      pendulum,
      ts,
    };
    debugLog("startAndBroadcast:payload", payload);

    void handleAction(payload, {
      onPlaybackEnded: params.onLocalPlaybackEnded,
      syncOrigin: "local",
      receivedAtMs: ts,
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
