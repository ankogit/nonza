import {
  applyStoredOutputDevice,
  getStoredAudioOutputDevice,
} from "./audio-devices";
import {
  Context as ToneContext,
  Distortion as ToneDistortion,
  EQ3 as ToneEQ3,
  FeedbackDelay as ToneFeedbackDelay,
  Filter as ToneFilter,
  PitchShift as TonePitchShift,
  Reverb as ToneReverb,
  connect as toneConnect,
} from "tone";
import { getOutputMuted } from "./output-mute";
import { stopSoundBarEmojiGate } from "./soundBarEmojiParticles";
import { subscribeSoundBarVolume } from "./soundBarVolume";
import { TimestretchWorklet } from "./audio/TimestretchWorklet";

type SessionId = string;

type SessionHandle =
  | { kind: "html"; audio: HTMLAudioElement; evictable: boolean }
  | {
      kind: "wa";
      dispose: () => void;
      evictable: boolean;
      runGateDryStop: () => void;
    };

const activeBySessionId = new Map<SessionId, SessionHandle>();

/** Гейт и ping-pong: pointer-up сначала запускает хвост, полный cleanup — позже. */
const gatePendReleaseBySessionId = new Map<SessionId, () => void>();
const unsubscribeMasterBySessionId = new Map<SessionId, () => void>();
const onEndedBySessionId = new Map<SessionId, () => void>();
const loopTickCleanupBySessionId = new Map<SessionId, () => void>();
const cancelledSessionIds = new Set<SessionId>();
const cancelledSessionTtlBySessionId = new Map<
  SessionId,
  ReturnType<typeof setTimeout>
>();
const playbackReadyFallbackBySessionId = new Map<
  SessionId,
  ReturnType<typeof setTimeout>
>();

let decodeCtx: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();
const inFlightDecodes = new Map<string, Promise<AudioBuffer>>();

function getDecodeContext(): AudioContext {
  if (!decodeCtx) decodeCtx = new AudioContext();
  return decodeCtx;
}

function makeSoundBarBufferKey(url: string, audioVersion: number): string {
  const t = url.trim();
  const v = Number.isFinite(audioVersion) ? Math.floor(audioVersion) : 0;
  return `${t}\0v${v}`;
}

async function decodeSoundBarUrl(
  url: string,
  audioVersion = 0,
): Promise<AudioBuffer> {
  const key = makeSoundBarBufferKey(url, audioVersion);
  const cached = bufferCache.get(key);
  if (cached) return cached;

  const existing = inFlightDecodes.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const response = await fetch(url.trim());
      if (!response.ok) throw new Error(`soundbar fetch ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await getDecodeContext().decodeAudioData(
        arrayBuffer.slice(0),
      );
      bufferCache.set(key, buffer);
      return buffer;
    } finally {
      inFlightDecodes.delete(key);
    }
  })();

  inFlightDecodes.set(key, promise);
  return await promise;
}

/** Параллельный decode всех уникальных (url, version) для саундбара. */
export async function preloadSoundBarAudioEntries(
  entries: { url: string; version: number }[],
): Promise<void> {
  const seen = new Set<string>();
  const tasks: Promise<AudioBuffer>[] = [];
  for (const e of entries) {
    const u = e.url?.trim() ?? "";
    if (!u) continue;
    const key = makeSoundBarBufferKey(u, e.version);
    if (seen.has(key)) continue;
    seen.add(key);
    tasks.push(decodeSoundBarUrl(u, e.version));
  }
  await Promise.all(tasks);
}

function reverseAudioBuffer(
  ctx: BaseAudioContext,
  forward: AudioBuffer,
): AudioBuffer {
  const channels = forward.numberOfChannels;
  const length = forward.length;
  const rate = ctx.sampleRate;
  const rev = ctx.createBuffer(channels, length, rate);
  for (let c = 0; c < channels; c++) {
    const input = forward.getChannelData(c);
    const output = rev.getChannelData(c);
    for (let i = 0; i < length; i++) {
      output[i] = input[length - 1 - i];
    }
  }
  return rev;
}

function clearPlaybackReadyFallback(sessionId: SessionId): void {
  const t = playbackReadyFallbackBySessionId.get(sessionId);
  if (t != null) {
    clearTimeout(t);
    playbackReadyFallbackBySessionId.delete(sessionId);
  }
}

function removeSessionHandle(sessionId: SessionId): void {
  const h = activeBySessionId.get(sessionId);
  if (!h) return;
  activeBySessionId.delete(sessionId);
  if (h.kind === "html") {
    const a = h.audio;
    try {
      a.pause();
    } catch {
      /* ignore */
    }
    try {
      a.src = "";
      a.load();
    } catch {
      /* ignore */
    }
  } else {
    try {
      h.dispose();
    } catch {
      /* ignore */
    }
  }
}

function cleanupSession(sessionId: SessionId): void {
  stopSoundBarEmojiGate(sessionId);
  gatePendReleaseBySessionId.delete(sessionId);
  clearPlaybackReadyFallback(sessionId);

  const unsubMaster = unsubscribeMasterBySessionId.get(sessionId);
  if (unsubMaster) {
    unsubMaster();
    unsubscribeMasterBySessionId.delete(sessionId);
  }

  const loopCleanup = loopTickCleanupBySessionId.get(sessionId);
  if (loopCleanup) {
    loopCleanup();
    loopTickCleanupBySessionId.delete(sessionId);
  }

  removeSessionHandle(sessionId);

  const cb = onEndedBySessionId.get(sessionId);
  if (cb) {
    onEndedBySessionId.delete(sessionId);
    cb();
  }
}

/** Одношоты без gate/loop при спаме создают по AudioContext на звук — ограничиваем хвост. */
const MAX_EVICTABLE_SOUND_BAR_SESSIONS = 12;

function countEvictableSoundBarSessions(): number {
  let n = 0;
  for (const h of activeBySessionId.values()) {
    if (h.evictable) n++;
  }
  return n;
}

function evictOldestEvictableSoundBarSession(): void {
  for (const id of activeBySessionId.keys()) {
    const h = activeBySessionId.get(id);
    if (h?.evictable) {
      cleanupSession(id);
      return;
    }
  }
}

/** Перед новым коротким one-shot освобождаем слоты, не трогая loop/gate. */
function ensureEvictableSoundBarCapacity(merged: SoundBarPlaybackStartParams): void {
  const incomingEvictable =
    !merged.loopEnabled && !Boolean(merged.gateEnabled);
  if (!incomingEvictable) return;
  while (countEvictableSoundBarSessions() >= MAX_EVICTABLE_SOUND_BAR_SESSIONS) {
    evictOldestEvictableSoundBarSession();
  }
}

async function applySink(audio: HTMLAudioElement): Promise<void> {
  try {
    await applyStoredOutputDevice(audio);
  } catch {
    /* ignore */
  }
}

function enablePitchPreservation(audio: HTMLAudioElement): void {
  const audioWithPitchFlags = audio as HTMLAudioElement & {
    preservesPitch?: boolean;
    mozPreservesPitch?: boolean;
    webkitPreservesPitch?: boolean;
  };
  audioWithPitchFlags.preservesPitch = true;
  audioWithPitchFlags.mozPreservesPitch = true;
  audioWithPitchFlags.webkitPreservesPitch = true;
}

async function applySinkToAudioContext(ctx: AudioContext): Promise<void> {
  const setSink = (
    ctx as unknown as { setSinkId?: (id: string) => Promise<void> }
  ).setSinkId;
  if (typeof setSink !== "function") return;
  const deviceId = getStoredAudioOutputDevice();
  try {
    await setSink.call(ctx, deviceId || "");
  } catch {
    /* ignore */
  }
}

/** Если в HTML duration так и не стал конечным — не блокируем UI бесконечно. */
const FALLBACK_CLIP_DURATION_SEC = 2.5;
/** После play() duration иногда приходит с задержкой; не ждём вечно. */
const PLAYBACK_READY_FALLBACK_MS = 400;
const VOICE_FADE_SEC = 0.01;
const SEAMLESS_RELEASE_FADE_SEC = 0.001;
const SEAMLESS_CHAIN_LOOKAHEAD_BASE_MS = 2;
const SEAMLESS_CHAIN_LOOKAHEAD_MAX_MS = 8;
const MIN_AUDIBLE_SEGMENT_SEC = 0.02;
/** Верхняя граница «догоняния» по сети при remote-start (секунды wall). */
const NETWORK_LAG_TRIM_CAP_SEC = 0.45;
const NEUTRAL_PITCH_EPSILON = 0.01;
const PITCH_SHIFT_WINDOW_SEC = 0.14;
const PITCH_SHIFT_STAGE_LIMIT_SEMITONES = 8;
const PITCH_SHIFT_DRAIN_TAIL_MS = 220;
const SOURCE_ONLY_DRAIN_TAIL_MS = 260;
const MAX_PITCH_SHIFT_DRAIN_TAIL_MS = 5000;
const HARD_SAFE_PITCH_TAIL_MS = 600;
const MAX_FX_TAIL_MS = 7000;
/** После отпускания gate — плавное затухание выхода с FX-хвостом (delay/reverb). */
const GATE_FX_TAIL_OUT_RAMP_SEC = 0.06;

function closeAudioContextQuietly(ctx: AudioContext): void {
  if (ctx.state === "closed") return;
  try {
    void ctx.close().catch(() => {
      /* двойной close / Tone уже закрыл underlying context */
    });
  } catch {
    /* ignore */
  }
}

function abortIfSessionCancelled(
  sessionId: SessionId,
  ctx: AudioContext,
): boolean {
  if (!isSessionCancelled(sessionId)) return false;
  closeAudioContextQuietly(ctx);
  return true;
}

function clampClipDurationSec(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return FALLBACK_CLIP_DURATION_SEC;
  return Math.min(60, Math.max(0.12, raw));
}

function clampSessionVolume(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.max(0, Math.min(5, v));
}

function clampPlaybackSpeed(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.max(0.25, Math.min(4, v));
}

function clampPlaybackPitch(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.max(0.25, Math.min(4, v));
}

function clampFxPercent(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function clampFxFilterHz(v: number): number {
  if (!Number.isFinite(v)) return 20000;
  return Math.max(200, Math.min(20000, v));
}

function clampDelayTimeMs(v: number): number {
  if (!Number.isFinite(v)) return 200;
  return Math.max(10, Math.min(2000, v));
}

function clampReverbDecayMs(v: number): number {
  if (!Number.isFinite(v)) return 1200;
  return Math.max(100, Math.min(6000, v));
}

function clampEqDb(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(-24, Math.min(24, v));
}

function hasActiveFx(fx: SoundBarFxSettings): boolean {
  return (
    clampFxPercent(fx.distortion) > 0 ||
    clampFxPercent(fx.delayWet) > 0 ||
    clampFxPercent(fx.reverbWet) > 0 ||
    clampDelayTimeMs(fx.delayTimeMs) !== 200 ||
    clampReverbDecayMs(fx.reverbDecayMs) !== 1200 ||
    clampEqDb(fx.eqLowDb) !== 0 ||
    clampEqDb(fx.eqMidDb) !== 0 ||
    clampEqDb(fx.eqHighDb) !== 0 ||
    clampFxFilterHz(fx.filterHz) < 19950
  );
}

function clampRange(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function isNeutralPitch(pitch: number): boolean {
  return Math.abs(pitch - 1) <= NEUTRAL_PITCH_EPSILON;
}

function splitPitchShiftSemitones(total: number): number[] {
  const stages: number[] = [];
  let remaining = total;
  while (Math.abs(remaining) > PITCH_SHIFT_STAGE_LIMIT_SEMITONES) {
    const step = Math.sign(remaining) * PITCH_SHIFT_STAGE_LIMIT_SEMITONES;
    stages.push(step);
    remaining -= step;
  }
  if (Math.abs(remaining) > 0.001) {
    stages.push(remaining);
  }
  return stages;
}

function markSessionCancelled(sessionId: SessionId): void {
  cancelledSessionIds.add(sessionId);
  const prevTtl = cancelledSessionTtlBySessionId.get(sessionId);
  if (prevTtl != null) {
    clearTimeout(prevTtl);
  }
  const ttl = window.setTimeout(() => {
    cancelledSessionIds.delete(sessionId);
    cancelledSessionTtlBySessionId.delete(sessionId);
  }, 60_000);
  cancelledSessionTtlBySessionId.set(sessionId, ttl);
}

function clearSessionCancelled(sessionId: SessionId): void {
  cancelledSessionIds.delete(sessionId);
  const ttl = cancelledSessionTtlBySessionId.get(sessionId);
  if (ttl != null) {
    clearTimeout(ttl);
    cancelledSessionTtlBySessionId.delete(sessionId);
  }
}

function isSessionCancelled(sessionId: SessionId): boolean {
  return cancelledSessionIds.has(sessionId);
}

export type SoundBarPlaybackReadyInfo = {
  durationSec: number;
  heardLapSec: number;
  heardTotalOnceSec: number;
};

export type SoundBarFxSettings = {
  filterHz: number;
  distortion: number;
  delayWet: number;
  delayTimeMs: number;
  reverbWet: number;
  reverbDecayMs: number;
  eqLowDb: number;
  eqMidDb: number;
  eqHighDb: number;
};

function heardTiming(
  baseSec: number,
  rate: number,
  pendulum: boolean,
): { heardLapSec: number; heardTotalOnceSec: number } {
  const lap = baseSec / rate;
  return {
    heardLapSec: lap,
    heardTotalOnceSec: pendulum ? lap * 2 : lap,
  };
}

function fireReady(
  sessionId: SessionId,
  baseSec: number,
  effectiveRate: number,
  pendulum: boolean,
  onPlaybackReady?: (info: SoundBarPlaybackReadyInfo) => void,
): void {
  clearPlaybackReadyFallback(sessionId);
  const durationSec = clampClipDurationSec(baseSec);
  const s = clampPlaybackSpeed(effectiveRate);
  const { heardLapSec, heardTotalOnceSec } = heardTiming(
    durationSec,
    s,
    pendulum,
  );
  onPlaybackReady?.({ durationSec, heardLapSec, heardTotalOnceSec });
}

export type SoundBarPlaybackSyncOrigin = "local" | "remote";

export type SoundBarPlaybackStartParams = {
  sessionId: SessionId;
  audioUrl: string;
  /** Версия файла; влияет на ключ decode-кэша. */
  audioVersion?: number;
  loopEnabled: boolean;
  gateEnabled?: boolean;
  sessionVolume: number;
  playbackSpeed: number;
  playbackPitch: number;
  fx: SoundBarFxSettings;
  reverse: boolean;
  pendulum: boolean;
  /** Локальный старт — без сетевого trim; remote — компенсация задержки канала. */
  syncOrigin?: SoundBarPlaybackSyncOrigin;
  /** Время отправки `start` с точки зрения отправителя (wall ms). */
  senderTsMs?: number;
  /** Время приёма сообщения у получателя (wall ms). */
  receivedAtMs?: number;
  onEnded?: () => void;
  onLoopTick?: () => void;
  onPlaybackReady?: (info: SoundBarPlaybackReadyInfo) => void;
  onGateNonLoopClipEnded?: () => void;
};

function computeInitialRemoteTrimSourceSec(
  params: SoundBarPlaybackStartParams,
  effectiveRate: number,
  playBufDurationSec: number,
): number {
  if (params.syncOrigin !== "remote") return 0;
  if (params.gateEnabled) return 0;
  const ts = params.senderTsMs;
  const rx = params.receivedAtMs;
  if (typeof ts !== "number" || typeof rx !== "number") return 0;
  const wallLagSec = Math.max(0, (rx - ts) / 1000);
  const cappedWall = Math.min(wallLagSec, NETWORK_LAG_TRIM_CAP_SEC);
  const trimSrc = cappedWall * Math.max(0.25, Math.min(4, effectiveRate));
  if (trimSrc <= MIN_AUDIBLE_SEGMENT_SEC) return 0;
  const maxTrim = Math.max(0, playBufDurationSec - MIN_AUDIBLE_SEGMENT_SEC);
  return Math.min(trimSrc, maxTrim);
}

async function startHtmlSoundBarSession(
  sessionId: SessionId,
  params: SoundBarPlaybackStartParams,
): Promise<void> {
  const {
    audioUrl,
    loopEnabled,
    sessionVolume,
    playbackSpeed,
    onLoopTick,
    onPlaybackReady,
    onGateNonLoopClipEnded,
  } = params;

  const trimmed = audioUrl.trim();
  const volMul = clampSessionVolume(sessionVolume);
  const speed = clampPlaybackSpeed(playbackSpeed);
  const effectiveRate = speed;

  const audio = new Audio(trimmed);
  audio.preload = "auto";
  audio.loop = loopEnabled;
  enablePitchPreservation(audio);
  audio.playbackRate = effectiveRate;

  unsubscribeMasterBySessionId.set(
    sessionId,
    subscribeSoundBarVolume((v) => {
      audio.volume = Math.max(0, Math.min(1, v * volMul));
    }),
  );

  const gateHtml = Boolean(params.gateEnabled);
  activeBySessionId.set(sessionId, {
    kind: "html",
    audio,
    evictable: !loopEnabled && !gateHtml,
  });

  let playbackReadyFired = false;
  function firePlaybackReadyOnce(): void {
    if (playbackReadyFired) return;
    const d = audio.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    playbackReadyFired = true;
    if (!loopEnabled) {
      const trim = computeInitialRemoteTrimSourceSec(params, effectiveRate, d);
      if (
        trim > MIN_AUDIBLE_SEGMENT_SEC &&
        trim < d - MIN_AUDIBLE_SEGMENT_SEC
      ) {
        try {
          audio.currentTime = trim;
        } catch {
          /* ignore */
        }
      }
    }
    const base = clampClipDurationSec(d);
    fireReady(sessionId, base, effectiveRate, params.pendulum, onPlaybackReady);
  }

  audio.addEventListener("loadedmetadata", firePlaybackReadyOnce);
  audio.addEventListener("durationchange", firePlaybackReadyOnce);

  const fallbackTimer = window.setTimeout(() => {
    if (playbackReadyFired) return;
    playbackReadyFired = true;
    playbackReadyFallbackBySessionId.delete(sessionId);
    fireReady(
      sessionId,
      FALLBACK_CLIP_DURATION_SEC,
      effectiveRate,
      params.pendulum,
      onPlaybackReady,
    );
  }, PLAYBACK_READY_FALLBACK_MS);
  playbackReadyFallbackBySessionId.set(sessionId, fallbackTimer);

  void applySink(audio);

  if (loopEnabled && onLoopTick) {
    let lastTime = 0;
    const onTimeUpdate = () => {
      if (lastTime > audio.currentTime + 0.35) {
        onLoopTick();
      }
      lastTime = audio.currentTime;
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    loopTickCleanupBySessionId.set(sessionId, () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
    });
  }

  const onAudioEnded = () => {
    onGateNonLoopClipEnded?.();
    cleanupSession(sessionId);
  };
  audio.addEventListener("ended", onAudioEnded, { once: true });
  audio.addEventListener("error", onAudioEnded, { once: true });

  try {
    await audio.play();
    firePlaybackReadyOnce();
  } catch {
    /* autoplay */
  }

  queueMicrotask(() => firePlaybackReadyOnce());
}

async function startWebAudioSoundBarSession(
  sessionId: SessionId,
  params: SoundBarPlaybackStartParams,
  forward: AudioBuffer,
): Promise<void> {
  const pendulum = params.pendulum;
  const gateEnabled = Boolean(params.gateEnabled);
  const loopEnabled = params.loopEnabled;

  const {
    sessionVolume,
    playbackSpeed,
    playbackPitch,
    fx,
    reverse,
    onLoopTick,
    onPlaybackReady,
    onGateNonLoopClipEnded,
  } = params;

  const volMul = clampSessionVolume(sessionVolume);
  const speed = clampPlaybackSpeed(playbackSpeed);
  const pitch = clampPlaybackPitch(playbackPitch);
  const fxFilterHz = clampFxFilterHz(fx.filterHz);
  const fxDistortion = clampFxPercent(fx.distortion) / 100;
  const fxDelayWet = clampFxPercent(fx.delayWet) / 100;
  const fxDelayTimeSec = clampDelayTimeMs(fx.delayTimeMs) / 1000;
  const fxReverbWet = clampFxPercent(fx.reverbWet) / 100;
  const fxReverbDecaySec = clampReverbDecayMs(fx.reverbDecayMs) / 1000;
  const eqLowDb = clampEqDb(fx.eqLowDb);
  const eqMidDb = clampEqDb(fx.eqMidDb);
  const eqHighDb = clampEqDb(fx.eqHighDb);
  const effectiveRate = speed;
  const baseSec = clampClipDurationSec(forward.duration);
  const fullDurationSec = forward.duration;

  /**
   * Сухой вход обрубили; delay/reverb ещё «дышат» — не глушить voiceGain сразу.
   * Только простой gate: при gate+pendulum (ping‑pong) оставляем прежнюю логику.
   */
  const gateFxSessionTailMs = (() => {
    if (!gateEnabled) return 0;
    if (pendulum) return 0;
    let ms = 0;
    if (fxDelayWet > 0.001) ms += Math.ceil(1200 + fxDelayWet * 3800);
    if (fxReverbWet > 0.001) ms += Math.ceil(1500 + fxReverbWet * 4500);
    if (ms <= 0) return 0;
    return Math.min(ms, MAX_FX_TAIL_MS);
  })();

  let ctx: AudioContext;
  try {
    ctx = new AudioContext({ sampleRate: forward.sampleRate });
  } catch {
    ctx = new AudioContext();
  }
  if (abortIfSessionCancelled(sessionId, ctx)) return;
  await ctx.resume();
  if (abortIfSessionCancelled(sessionId, ctx)) return;
  await applySinkToAudioContext(ctx);
  if (abortIfSessionCancelled(sessionId, ctx)) return;
  if (Math.abs(speed - 1) > 0.0001) {
    await TimestretchWorklet.ensureModuleLoaded(ctx);
    if (abortIfSessionCancelled(sessionId, ctx)) return;
  }

  const toneCtx = new ToneContext({ context: ctx, lookAhead: 0 });
  const gainNode = ctx.createGain();
  gainNode.connect(ctx.destination);

  let stopped = false;
  const activeVoiceDisposers = new Set<() => void>();
  let currentLapCleanup: (() => void) | null = null;
  let currentSegmentStartedAtSec = 0;
  let currentSegmentSourceOffsetSec = 0;

  function setCurrentSegmentClock(offsetSec: number): void {
    currentSegmentStartedAtSec = ctx.currentTime;
    currentSegmentSourceOffsetSec = Math.max(0, offsetSec);
  }

  function getCurrentHeldSourceSec(maxDurationSec: number): number {
    const playedWall = Math.max(
      0,
      ctx.currentTime - currentSegmentStartedAtSec,
    );
    const playedSource = playedWall * effectiveRate;
    return clampRange(
      currentSegmentSourceOffsetSec + playedSource,
      0,
      maxDurationSec,
    );
  }

  const setGainFromMaster = (master: number) => {
    if (stopped || gainNode.context.state === "closed") return;
    try {
      const t = ctx.currentTime;
      const g = Math.max(0, master * volMul);
      gainNode.gain.cancelScheduledValues(t);
      const cur = Math.min(1, Math.max(0, gainNode.gain.value));
      gainNode.gain.setValueAtTime(cur, t);
      gainNode.gain.linearRampToValueAtTime(g, t + 0.028);
    } catch {
      /* ignore */
    }
  };

  unsubscribeMasterBySessionId.set(
    sessionId,
    subscribeSoundBarVolume(setGainFromMaster),
  );

  const dispose = () => {
    if (stopped) return;
    stopped = true;
    currentLapCleanup?.();
    currentLapCleanup = null;
    for (const disposeVoice of activeVoiceDisposers) {
      disposeVoice();
    }
    activeVoiceDisposers.clear();
    try {
      gainNode.disconnect();
    } catch {
      /* ignore */
    }
    try {
      toneCtx.dispose();
    } catch {
      /* ignore */
    }
    closeAudioContextQuietly(ctx);
  };

  const reverseBuf = reverse ? reverseAudioBuffer(ctx, forward) : null;
  const playBuf = reverse && !pendulum && reverseBuf ? reverseBuf : forward;

  const remoteTrimSourceSec = computeInitialRemoteTrimSourceSec(
    params,
    effectiveRate,
    playBuf.duration,
  );
  const remoteSegOneShot =
    remoteTrimSourceSec > MIN_AUDIBLE_SEGMENT_SEC
      ? { offsetSec: remoteTrimSourceSec }
      : undefined;
  const remoteSegLoopFirst =
    remoteTrimSourceSec > MIN_AUDIBLE_SEGMENT_SEC
      ? {
          offsetSec: remoteTrimSourceSec,
          offsetSecAppliesOnlyToFirstVoice: true as const,
        }
      : undefined;

  function stopCurrentPlayback(): void {
    currentLapCleanup?.();
    currentLapCleanup = null;
    for (const disposeVoice of activeVoiceDisposers) {
      disposeVoice();
    }
    activeVoiceDisposers.clear();
  }

  function runGateDryStop(): void {
    stopCurrentPlayback();
    stopSoundBarEmojiGate(sessionId);
    if (gateFxSessionTailMs > 0) {
      const rampMs = Math.ceil(GATE_FX_TAIL_OUT_RAMP_SEC * 1000);
      const deferMs = gateFxSessionTailMs + rampMs + 220;
      window.setTimeout(() => {
        cleanupSession(sessionId);
      }, deferMs);
    } else {
      cleanupSession(sessionId);
    }
  }

  function stopPlaybackAndFinalizeSession(): void {
    runGateDryStop();
  }

  activeBySessionId.set(sessionId, {
    kind: "wa",
    dispose,
    evictable: !loopEnabled && !gateEnabled,
    runGateDryStop,
  });

  function sliceBufferSegment(
    buffer: AudioBuffer,
    offsetSec: number,
    durationSec?: number,
  ): AudioBuffer {
    const startSec = clampRange(offsetSec, 0, buffer.duration);
    const remainingSec = Math.max(0, buffer.duration - startSec);
    const wantedSec =
      durationSec == null
        ? remainingSec
        : clampRange(durationSec, 0, remainingSec);
    const startFrame = Math.floor(startSec * buffer.sampleRate);
    const frameCount = Math.max(1, Math.ceil(wantedSec * buffer.sampleRate));
    const out = ctx.createBuffer(
      buffer.numberOfChannels,
      frameCount,
      buffer.sampleRate,
    );
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const src = buffer.getChannelData(c);
      const dst = out.getChannelData(c);
      dst.set(src.subarray(startFrame, startFrame + frameCount));
    }
    return out;
  }

  function playWithSessionPipeline(
    buffer: AudioBuffer,
    loopThis: boolean,
    onDone: () => void,
    onLoopLap?: () => void,
    seg?: {
      offsetSec?: number;
      durationSec?: number;
      seamlessFromHold?: boolean;
      seamlessChain?: boolean;
      /** Только первый voice в режиме loop; дальше offset сбрасывается. */
      offsetSecAppliesOnlyToFirstVoice?: boolean;
    },
  ): void {
    if (stopped) return;
    if (!seg?.seamlessChain) {
      stopCurrentPlayback();
    }

    const offsetSec = Math.max(0, seg?.offsetSec ?? 0);
    const durationSec = seg?.durationSec;
    const hasSegmentWindow =
      offsetSec > 0 || (durationSec != null && durationSec < buffer.duration);
    const playBuffer = hasSegmentWindow
      ? sliceBufferSegment(buffer, offsetSec, durationSec)
      : buffer;
    const audibleDurationSec = playBuffer.duration / Math.max(0.001, speed);

    const voiceGain = ctx.createGain();
    voiceGain.connect(gainNode);
    const now = ctx.currentTime;
    const fadeInSec =
      seg?.seamlessFromHold || seg?.seamlessChain
        ? SEAMLESS_RELEASE_FADE_SEC
        : VOICE_FADE_SEC;
    voiceGain.gain.setValueAtTime(0, now);
    voiceGain.gain.linearRampToValueAtTime(1, now + fadeInSec);

    const pitchRatio = clampPlaybackPitch(pitch);
    const compensatedPitchRatio = pitchRatio / Math.max(0.0001, speed);
    const pitchSemitones =
      12 * Math.log2(Math.max(0.0001, compensatedPitchRatio));
    const plannedPitchShiftStages =
      Math.abs(compensatedPitchRatio - 1) > NEUTRAL_PITCH_EPSILON
        ? splitPitchShiftSemitones(pitchSemitones)
        : [];
    const hasPitchShiftTail = plannedPitchShiftStages.length > 0;
    const pitchShiftDrainTailMs = hasPitchShiftTail
      ? Math.min(
          MAX_PITCH_SHIFT_DRAIN_TAIL_MS,
          Math.ceil(
            PITCH_SHIFT_DRAIN_TAIL_MS +
              plannedPitchShiftStages.length * 350 +
              Math.abs(pitchSemitones) * 35,
          ),
        )
      : SOURCE_ONLY_DRAIN_TAIL_MS;
    const speedTailMs = Math.max(0, Math.ceil((speed - 1) * 180));
    const finalDrainTailMs = hasPitchShiftTail
      ? Math.max(pitchShiftDrainTailMs + speedTailMs, HARD_SAFE_PITCH_TAIL_MS)
      : pitchShiftDrainTailMs + speedTailMs;
    let doneFired = false;
    const finishDone = () => {
      if (doneFired || stopped) return;
      doneFired = true;
      if (loopThis) return;
      onDone();
    };

    const onVoiceStop = () => {
      if (stopped) return;
      if (loopThis) {
        onLoopLap?.();
        const nextSeg =
          seg?.offsetSecAppliesOnlyToFirstVoice === true
            ? { ...seg, offsetSec: 0, offsetSecAppliesOnlyToFirstVoice: false }
            : seg;
        playWithSessionPipeline(buffer, true, onDone, onLoopLap, nextSeg);
        return;
      }
      if (seg?.seamlessChain) return;
      window.setTimeout(() => finishDone(), finalDrainTailMs + fxTailBonusMs);
    };
    const source = ctx.createBufferSource();
    source.buffer = playBuffer;
    source.loop = false;
    source.playbackRate.value = speed;
    let worklet: TimestretchWorklet | null = null;
    let pitchShiftNodes: TonePitchShift[] = [];
    let fxNodes: Array<
      ToneEQ3 | ToneFilter | ToneDistortion | ToneFeedbackDelay | ToneReverb
    > = [];
    let fxTailBonusMs = 0;
    let disposed = false;
    let started = false;
    const needsWorklet = Math.abs(speed - 1) > 0.0001;

    function buildFxChain(): AudioNode {
      fxNodes = [];
      const eqNode = new ToneEQ3({
        context: toneCtx,
        low: eqLowDb,
        mid: eqMidDb,
        high: eqHighDb,
      });
      fxNodes.push(eqNode);
      const filterNode = new ToneFilter({
        context: toneCtx,
        type: "lowpass",
        frequency: fxFilterHz,
        Q: 0.6,
      });
      fxNodes.push(filterNode);

      if (fxDistortion > 0.001) {
        fxNodes.push(
          new ToneDistortion({
            context: toneCtx,
            distortion: Math.min(0.95, fxDistortion),
            wet: 1,
          }),
        );
      }
      if (fxDelayWet > 0.001) {
        fxNodes.push(
          new ToneFeedbackDelay({
            context: toneCtx,
            delayTime: fxDelayTimeSec,
            feedback: Math.min(0.7, 0.2 + fxDelayWet * 0.5),
            wet: fxDelayWet,
          }),
        );
        fxTailBonusMs = Math.max(fxTailBonusMs, Math.ceil(1200 + fxDelayWet * 3800));
      }
      if (fxReverbWet > 0.001) {
        fxNodes.push(
          new ToneReverb({
            context: toneCtx,
            decay: fxReverbDecaySec,
            preDelay: 0.01,
            wet: fxReverbWet,
          }),
        );
        fxTailBonusMs = Math.max(fxTailBonusMs, Math.ceil(1500 + fxReverbWet * 4500));
      }
      fxTailBonusMs = Math.min(fxTailBonusMs, MAX_FX_TAIL_MS);

      for (let i = 1; i < fxNodes.length; i++) {
        toneConnect(fxNodes[i - 1], fxNodes[i]);
      }
      return fxNodes[fxNodes.length - 1] as unknown as AudioNode;
    }

    function connectPitchAndFxFrom(input: AudioNode): void {
      const fxOutputNode = buildFxChain();
      toneConnect(fxOutputNode, voiceGain as unknown as AudioNode);

      if (Math.abs(compensatedPitchRatio - 1) <= NEUTRAL_PITCH_EPSILON) {
        toneConnect(input, fxNodes[0]!);
        return;
      }

      pitchShiftNodes = plannedPitchShiftStages.map(
        (stage) =>
          new TonePitchShift({
            context: toneCtx,
            pitch: stage,
            windowSize: PITCH_SHIFT_WINDOW_SEC,
            feedback: 0,
            wet: 1,
          }),
      );
      if (pitchShiftNodes.length === 0) {
        toneConnect(input, fxNodes[0]!);
        return;
      }

      toneConnect(input, pitchShiftNodes[0]);
      for (let i = 1; i < pitchShiftNodes.length; i++) {
        toneConnect(pitchShiftNodes[i - 1], pitchShiftNodes[i]);
      }
      toneConnect(pitchShiftNodes[pitchShiftNodes.length - 1], fxNodes[0]!);
    }

    if (!needsWorklet) {
      connectPitchAndFxFrom(source);
      setCurrentSegmentClock(offsetSec);
      source.start();
      started = true;
    } else {
      try {
        worklet = TimestretchWorklet.createWorkletSync({
          ctx,
          bufferSource: source,
          pitch: 1,
          opts: {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [
              Math.max(1, Math.min(2, playBuffer.numberOfChannels)),
            ],
          },
        });
      } catch {
        cleanupSession(sessionId);
        return;
      }
      if (stopped || disposed) {
        try {
          worklet.workletNode?.disconnect();
        } catch {
          /* ignore */
        }
        return;
      }
      worklet.updateSpeed(speed);
      worklet.updatePitch(1);
      connectPitchAndFxFrom(worklet.workletNode as unknown as AudioNode);
      setCurrentSegmentClock(offsetSec);
      source.start();
      started = true;
    }

    source.onended = () => {
      if (stopped || disposed) return;
      onVoiceStop();
      if (seg?.seamlessChain) {
        finishDone();
      }
    };

    if (seg?.seamlessChain && !loopThis && speed > 1 && audibleDurationSec > 0) {
      const adaptiveLookaheadMs = Math.min(
        SEAMLESS_CHAIN_LOOKAHEAD_MAX_MS,
        Math.max(
          SEAMLESS_CHAIN_LOOKAHEAD_BASE_MS,
          SEAMLESS_CHAIN_LOOKAHEAD_BASE_MS + (speed - 1) * 2,
        ),
      );
      const triggerMs = Math.max(
        0,
        audibleDurationSec * 1000 - adaptiveLookaheadMs,
      );
      window.setTimeout(() => {
        if (stopped || disposed) return;
        finishDone();
      }, triggerMs);
    }
    const disposeVoice = () => {
      if (disposed) return;
      disposed = true;
      activeVoiceDisposers.delete(disposeVoice);
      const t = ctx.currentTime;
      const useFxTailGateStop = gateFxSessionTailMs > 0;

      const disconnectGraph = (): void => {
        try {
          source.disconnect();
        } catch {
          /* ignore */
        }
        try {
          worklet?.workletNode?.disconnect();
        } catch {
          /* ignore */
        }
        try {
          for (const node of pitchShiftNodes) {
            node.disconnect();
            node.dispose();
          }
          pitchShiftNodes = [];
        } catch {
          /* ignore */
        }
        try {
          for (const node of fxNodes) {
            node.disconnect();
            node.dispose();
          }
          fxNodes = [];
        } catch {
          /* ignore */
        }
      };

      if (!useFxTailGateStop) {
        try {
          voiceGain.gain.cancelScheduledValues(t);
          voiceGain.gain.setValueAtTime(Math.max(0, voiceGain.gain.value), t);
          voiceGain.gain.linearRampToValueAtTime(0, t + VOICE_FADE_SEC);
        } catch {
          /* ignore */
        }
        if (started) {
          try {
            source.stop(t + VOICE_FADE_SEC);
          } catch {
            /* ignore */
          }
        }
        window.setTimeout(
          disconnectGraph,
          Math.ceil((VOICE_FADE_SEC + 0.02) * 1000),
        );
        return;
      }

      if (started) {
        try {
          source.stop(t + 0.003);
        } catch {
          /* ignore */
        }
      }
      const rampMs = Math.ceil(GATE_FX_TAIL_OUT_RAMP_SEC * 1000);
      window.setTimeout(() => {
        if (stopped) return;
        try {
          const t2 = ctx.currentTime;
          voiceGain.gain.cancelScheduledValues(t2);
          voiceGain.gain.setValueAtTime(Math.max(1e-4, voiceGain.gain.value), t2);
          voiceGain.gain.linearRampToValueAtTime(
            0,
            t2 + GATE_FX_TAIL_OUT_RAMP_SEC,
          );
        } catch {
          /* ignore */
        }
      }, gateFxSessionTailMs);
      window.setTimeout(
        disconnectGraph,
        gateFxSessionTailMs + rampMs + 80,
      );
    };
    activeVoiceDisposers.add(disposeVoice);

  }

  function finishNatural(): void {
    onGateNonLoopClipEnded?.();
    cleanupSession(sessionId);
  }

  fireReady(
    sessionId,
    baseSec,
    effectiveRate,
    pendulum && !gateEnabled,
    onPlaybackReady,
  );

  if (!gateEnabled && !pendulum) {
    if (loopEnabled) {
      playWithSessionPipeline(
        playBuf,
        true,
        () => {},
        onLoopTick,
        remoteSegLoopFirst,
      );
    } else {
      playWithSessionPipeline(
        playBuf,
        false,
        () => finishNatural(),
        undefined,
        remoteSegOneShot,
      );
    }
    return;
  }

  if (gateEnabled && pendulum && reverse && reverseBuf) {
    if (loopEnabled) {
      const reverseLoopBuffer = reverseBuf;
      let userReleased = false;
      let playReverse = true;

      function playGateLoopCycle(): void {
        if (stopped || userReleased) return;
        const current = playReverse ? reverseLoopBuffer : forward;
        playWithSessionPipeline(current, false, () => {
          if (stopped || userReleased) return;
          playReverse = !playReverse;
          playGateLoopCycle();
        }, undefined, { seamlessChain: true });
      }

      gatePendReleaseBySessionId.set(sessionId, () => {
        if (stopped) return;
        if (userReleased) {
          cleanupSession(sessionId);
          return;
        }
        userReleased = true;
        stopPlaybackAndFinalizeSession();
      });

      playGateLoopCycle();
      return;
    }

    let reverseExhausted = false;
    let userReleased = false;

    let tailStarted = false;

    /** После удержания на реверсе — добираем вперёд до конца файла (уже не reverse-буфер). */
    function playForwardTailAfterReverseHold(playedRevSec: number): void {
      if (stopped || tailStarted) return;
      tailStarted = true;
      const played = Math.min(fullDurationSec, Math.max(0, playedRevSec));
      if (played < MIN_AUDIBLE_SEGMENT_SEC) {
        cleanupSession(sessionId);
        return;
      }
      const offFwd = fullDurationSec - played;
      const durFwd = played;
      if (durFwd < MIN_AUDIBLE_SEGMENT_SEC) {
        cleanupSession(sessionId);
        return;
      }
      playWithSessionPipeline(
        forward,
        false,
        () => cleanupSession(sessionId),
        undefined,
        {
          offsetSec: offFwd,
          durationSec: durFwd,
          seamlessFromHold: true,
        },
      );
    }

    gatePendReleaseBySessionId.set(sessionId, () => {
      if (stopped) return;
      if (userReleased) {
        cleanupSession(sessionId);
        return;
      }
      userReleased = true;
      const playedRev = reverseExhausted
        ? fullDurationSec
        : getCurrentHeldSourceSec(fullDurationSec);
      stopSoundBarEmojiGate(sessionId);
      playForwardTailAfterReverseHold(playedRev);
    });

    playWithSessionPipeline(reverseBuf, false, () => {
      reverseExhausted = true;
    });
    return;
  }

  if (gateEnabled && pendulum) {
    if (loopEnabled) {
      let userReleased = false;
      let playForward = true;
      const revFullLoop = reverseAudioBuffer(ctx, forward);

      function playGatePendulumCycle(): void {
        if (stopped || userReleased) return;
        const current = playForward ? forward : revFullLoop;
        playWithSessionPipeline(current, false, () => {
          if (stopped || userReleased) return;
          playForward = !playForward;
          playGatePendulumCycle();
        }, undefined, { seamlessChain: true });
      }

      gatePendReleaseBySessionId.set(sessionId, () => {
        if (stopped) return;
        if (userReleased) {
          cleanupSession(sessionId);
          return;
        }
        userReleased = true;
        stopPlaybackAndFinalizeSession();
      });

      playGatePendulumCycle();
      return;
    }

    let forwardExhausted = false;
    let userReleased = false;
    const revFull = reverseAudioBuffer(ctx, forward);

    let tailStarted = false;

    function playReverseFromPlayedSeconds(playedSec: number): void {
      if (stopped || tailStarted) return;
      tailStarted = true;
      const played = Math.min(fullDurationSec, Math.max(0, playedSec));
      if (played < MIN_AUDIBLE_SEGMENT_SEC) {
        cleanupSession(sessionId);
        return;
      }
      const off = Math.max(0, fullDurationSec - played);
      playWithSessionPipeline(
        revFull,
        false,
        () => cleanupSession(sessionId),
        undefined,
        {
          offsetSec: off,
          durationSec: played,
          seamlessFromHold: true,
        },
      );
    }

    gatePendReleaseBySessionId.set(sessionId, () => {
      if (stopped) return;
      if (userReleased) {
        cleanupSession(sessionId);
        return;
      }
      userReleased = true;
      const playedSec = forwardExhausted
        ? fullDurationSec
        : getCurrentHeldSourceSec(fullDurationSec);
      stopSoundBarEmojiGate(sessionId);
      playReverseFromPlayedSeconds(playedSec);
    });

    playWithSessionPipeline(forward, false, () => {
      forwardExhausted = true;
    });
    return;
  }

  if (gateEnabled && reverse && reverseBuf && !pendulum) {
    const reverseOnlyBuffer = reverseBuf;
    if (loopEnabled) {
      let userReleased = false;

      function playReverseGateLoop(): void {
        if (stopped || userReleased) return;
        playWithSessionPipeline(reverseOnlyBuffer, false, () => {
          if (stopped || userReleased) return;
          playReverseGateLoop();
        });
      }

      gatePendReleaseBySessionId.set(sessionId, () => {
        if (stopped) return;
        if (userReleased) {
          cleanupSession(sessionId);
          return;
        }
        userReleased = true;
        stopPlaybackAndFinalizeSession();
      });

      playReverseGateLoop();
      return;
    }

    playWithSessionPipeline(
      reverseOnlyBuffer,
      false,
      () => finishNatural(),
      undefined,
      remoteSegOneShot,
    );
    return;
  }

  if (loopEnabled && pendulum && !gateEnabled) {
    const revFull = reverseAudioBuffer(ctx, forward);
    let pingPongPrimed = true;
    function playPingPongCycle(): void {
      if (stopped) return;
      const fwdSeg =
        pingPongPrimed && remoteSegOneShot
          ? { ...remoteSegOneShot, seamlessChain: true as const }
          : { seamlessChain: true as const };
      pingPongPrimed = false;
      playWithSessionPipeline(forward, false, () => {
        if (stopped) return;
        playWithSessionPipeline(revFull, false, () => {
          if (stopped) return;
          onLoopTick?.();
          playPingPongCycle();
        }, undefined, { seamlessChain: true });
      }, undefined, fwdSeg);
    }
    playPingPongCycle();
    return;
  }

  if (pendulum && !gateEnabled) {
    playWithSessionPipeline(
      forward,
      false,
      () => {
        if (stopped) return;
        const revB = reverseAudioBuffer(ctx, forward);
        playWithSessionPipeline(revB, false, () => {
          cleanupSession(sessionId);
        });
      },
      undefined,
      remoteSegOneShot,
    );
    return;
  }

  if (loopEnabled) {
    playWithSessionPipeline(
      playBuf,
      true,
      () => {},
      onLoopTick,
      remoteSegLoopFirst,
    );
    return;
  }

  playWithSessionPipeline(
    playBuf,
    false,
    () => finishNatural(),
    undefined,
    remoteSegOneShot,
  );
}

export async function startSoundBarSession(
  params: SoundBarPlaybackStartParams,
): Promise<void> {
  const {
    sessionId,
    audioUrl,
    pendulum,
    reverse,
    onEnded,
    onPlaybackReady,
    playbackPitch,
    fx,
  } = params;

  if (isSessionCancelled(sessionId)) {
    clearSessionCancelled(sessionId);
    return;
  }
  if (activeBySessionId.has(sessionId)) cleanupSession(sessionId);

  const gateEnabled = Boolean(params.gateEnabled);
  const reverseEff = Boolean(reverse) && (!pendulum || gateEnabled);
  const audioVersionNorm =
    typeof params.audioVersion === "number" && Number.isFinite(params.audioVersion)
      ? Math.floor(params.audioVersion)
      : 0;
  const merged: SoundBarPlaybackStartParams = {
    ...params,
    audioVersion: audioVersionNorm,
    syncOrigin: params.syncOrigin ?? "local",
    playbackPitch: clampPlaybackPitch(playbackPitch),
    fx: {
      filterHz: clampFxFilterHz(fx?.filterHz ?? 20000),
      distortion: clampFxPercent(fx?.distortion ?? 0),
      delayWet: clampFxPercent(fx?.delayWet ?? 0),
      delayTimeMs: clampDelayTimeMs(fx?.delayTimeMs ?? 200),
      reverbWet: clampFxPercent(fx?.reverbWet ?? 0),
      reverbDecayMs: clampReverbDecayMs(fx?.reverbDecayMs ?? 1200),
      eqLowDb: clampEqDb(fx?.eqLowDb ?? 0),
      eqMidDb: clampEqDb(fx?.eqMidDb ?? 0),
      eqHighDb: clampEqDb(fx?.eqHighDb ?? 0),
    },
    reverse: reverseEff,
  };
  if (isNeutralPitch(merged.playbackPitch)) {
    merged.playbackPitch = 1;
  }

  ensureEvictableSoundBarCapacity(merged);

  const speed = clampPlaybackSpeed(params.playbackSpeed);
  const effectiveRate = speed;
  const complexPlaybackRequested =
    Boolean(merged.gateEnabled) ||
    merged.pendulum ||
    merged.reverse ||
    Math.abs(speed - 1) > 0.0001 ||
    !isNeutralPitch(merged.playbackPitch) ||
    hasActiveFx(merged.fx);

  if (getOutputMuted()) {
    fireReady(
      sessionId,
      FALLBACK_CLIP_DURATION_SEC,
      effectiveRate,
      pendulum,
      onPlaybackReady,
    );
    onEnded?.();
    return;
  }

  const trimmed = audioUrl.trim();
  if (!trimmed) {
    onEnded?.();
    return;
  }

  if (onEnded) onEndedBySessionId.set(sessionId, onEnded);

  try {
    const forward = await decodeSoundBarUrl(trimmed, merged.audioVersion ?? 0);
    if (isSessionCancelled(sessionId)) {
      cleanupSession(sessionId);
      return;
    }
    await startWebAudioSoundBarSession(sessionId, merged, forward);
  } catch {
    if (isSessionCancelled(sessionId)) {
      cleanupSession(sessionId);
      return;
    }
    if (complexPlaybackRequested) {
      try {
        const forwardRetry = await decodeSoundBarUrl(
          trimmed,
          merged.audioVersion ?? 0,
        );
        if (isSessionCancelled(sessionId)) {
          cleanupSession(sessionId);
          return;
        }
        await startWebAudioSoundBarSession(sessionId, merged, forwardRetry);
        return;
      } catch {
        if (isSessionCancelled(sessionId)) {
          cleanupSession(sessionId);
          return;
        }
        cleanupSession(sessionId);
        return;
      }
    }
    if (isSessionCancelled(sessionId)) {
      cleanupSession(sessionId);
      return;
    }
    await startHtmlSoundBarSession(sessionId, {
      ...merged,
      reverse: false,
      pendulum: false,
    });
  }
}

export function stopSoundBarSession(sessionId: SessionId): void {
  markSessionCancelled(sessionId);
  const release = gatePendReleaseBySessionId.get(sessionId);
  if (release) {
    release();
    return;
  }
  const h = activeBySessionId.get(sessionId);
  if (h?.kind === "wa") {
    h.runGateDryStop();
    return;
  }
  cleanupSession(sessionId);
}
