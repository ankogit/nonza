import {
  applyStoredOutputDevice,
  getStoredAudioOutputDevice,
} from "./audio-devices";
import { PitchShifter } from "soundtouchjs";
import { getOutputMuted } from "./output-mute";
import { stopSoundBarEmojiGate } from "./soundBarEmojiParticles";
import { subscribeSoundBarVolume } from "./soundBarVolume";

type SessionId = string;

type SessionHandle =
  | { kind: "html"; audio: HTMLAudioElement }
  | { kind: "wa"; dispose: () => void };

const activeBySessionId = new Map<SessionId, SessionHandle>();

/** Гейт и ping-pong: pointer-up сначала запускает хвост, полный cleanup — позже. */
const gatePendReleaseBySessionId = new Map<SessionId, () => void>();
const unsubscribeMasterBySessionId = new Map<SessionId, () => void>();
const onEndedBySessionId = new Map<SessionId, () => void>();
const loopTickCleanupBySessionId = new Map<SessionId, () => void>();
const cancelledSessionIds = new Set<SessionId>();
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

async function decodeSoundBarUrl(url: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(url);
  if (cached) return cached;

  const existing = inFlightDecodes.get(url);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`soundbar fetch ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await getDecodeContext().decodeAudioData(arrayBuffer.slice(0));
      bufferCache.set(url, buffer);
      return buffer;
    } finally {
      inFlightDecodes.delete(url);
    }
  })();

  inFlightDecodes.set(url, promise);
  return await promise;
}

function reverseAudioBuffer(ctx: BaseAudioContext, forward: AudioBuffer): AudioBuffer {
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
  cancelledSessionIds.delete(sessionId);

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

async function applySink(audio: HTMLAudioElement): Promise<void> {
  try {
    await applyStoredOutputDevice(audio);
  } catch {
    /* ignore */
  }
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
const PLAYBACK_READY_FALLBACK_MS = 900;
/**
 * bufferSize PitchShifter в сэмплах для режима гейта.
 * Слишком мало — слышны «пошёлки» по границам ScriptProcessor; 2048 — компромисс с метром.
 */
const GATE_PITCH_SHIFT_BLOCK_FRAMES = 2048;
/**
 * Линейное затухание на Gain перед disconnect PitchShifter.
 * ScriptProcessor/SoundTouch при резком disconnect даёт щелчок; при смене сегмента — то же + стык амплитуд.
 */
const PITCH_TAIL_RELEASE_SEC = 0.006;
/** Больше кадр ScriptProcessor — меньше артефактов на границах блока, чуть выше задержка. */
const PITCH_SHIFT_DEFAULT_BUFFER_FRAMES = 8192;

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

function clampRange(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Хвост из нулей после сегмента: SoundTouch догоняет выход после конца входа;
 * без запаса слышен обрыв, сильнее при низком pitch / медленном tempo.
 */
function soundTouchTailPaddingSec(
  speed: number,
  pitch: number,
  isReverseSegment: boolean,
): number {
  const base = 0.2;
  const whenSlowed = Math.max(0, 1 - speed) * 0.35;
  const fromPitchOctaves = Math.abs(Math.log2(Math.max(0.25, pitch))) * 0.14;
  const lowPitchExtra = pitch < 1 ? (1 / Math.max(0.25, pitch) - 1) * 0.22 : 0;
  const reverseExtra = isReverseSegment ? 0.14 : 0;
  return clampRange(
    base + whenSlowed + fromPitchOctaves + lowPitchExtra + reverseExtra,
    0.18,
    1.05,
  );
}

function markSessionCancelled(sessionId: SessionId): void {
  cancelledSessionIds.add(sessionId);
}

function clearSessionCancelled(sessionId: SessionId): void {
  cancelledSessionIds.delete(sessionId);
}

function isSessionCancelled(sessionId: SessionId): boolean {
  return cancelledSessionIds.has(sessionId);
}

export type SoundBarPlaybackReadyInfo = {
  durationSec: number;
  heardLapSec: number;
  heardTotalOnceSec: number;
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
  const { heardLapSec, heardTotalOnceSec } = heardTiming(durationSec, s, pendulum);
  onPlaybackReady?.({ durationSec, heardLapSec, heardTotalOnceSec });
}

export type SoundBarPlaybackStartParams = {
  sessionId: SessionId;
  audioUrl: string;
  loopEnabled: boolean;
  gateEnabled?: boolean;
  sessionVolume: number;
  playbackSpeed: number;
  playbackPitch: number;
  reverse: boolean;
  pendulum: boolean;
  onEnded?: () => void;
  onLoopTick?: () => void;
  onPlaybackReady?: (info: SoundBarPlaybackReadyInfo) => void;
  onGateNonLoopClipEnded?: () => void;
};

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
  audio.playbackRate = effectiveRate;

  unsubscribeMasterBySessionId.set(
    sessionId,
    subscribeSoundBarVolume((v) => {
      audio.volume = Math.max(0, Math.min(1, v * volMul));
    }),
  );

  activeBySessionId.set(sessionId, { kind: "html", audio });

  let playbackReadyFired = false;
  function firePlaybackReadyOnce(): void {
    if (playbackReadyFired) return;
    const d = audio.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    playbackReadyFired = true;
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
  const onAudioError = () => {
    onGateNonLoopClipEnded?.();
    cleanupSession(sessionId);
  };
  audio.addEventListener("ended", onAudioEnded, { once: true });
  audio.addEventListener("error", onAudioError, { once: true });

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
    reverse,
    onLoopTick,
    onPlaybackReady,
    onGateNonLoopClipEnded,
  } = params;

  const volMul = clampSessionVolume(sessionVolume);
  const speed = clampPlaybackSpeed(playbackSpeed);
  const pitch = clampPlaybackPitch(playbackPitch);
  const effectiveRate = speed;
  const baseSec = clampClipDurationSec(forward.duration);
  const D = forward.duration;

  let ctx: AudioContext;
  try {
    ctx = new AudioContext({ sampleRate: forward.sampleRate });
  } catch {
    ctx = new AudioContext();
  }
  if (isSessionCancelled(sessionId)) {
    try {
      void ctx.close();
    } catch {
      /* ignore */
    }
    return;
  }
  await ctx.resume();
  if (isSessionCancelled(sessionId)) {
    try {
      void ctx.close();
    } catch {
      /* ignore */
    }
    return;
  }
  await applySinkToAudioContext(ctx);
  if (isSessionCancelled(sessionId)) {
    try {
      void ctx.close();
    } catch {
      /* ignore */
    }
    return;
  }

  const gainNode = ctx.createGain();
  gainNode.connect(ctx.destination);

  function gateHeardSourceSeconds(timePlayedSec: number): number {
    return Math.max(0, timePlayedSec - GATE_PITCH_SHIFT_BLOCK_FRAMES / ctx.sampleRate);
  }
  /** Берём минимум из «стены» и метра SoundTouch — иначе хвост после гейта стартует слишком рано. */
  function mergeGateHoldPlayedSec(wallPlayedSec: number, shifter: PitchShifter | null): number {
    const wall = Math.min(D, Math.max(0, wallPlayedSec));
    if (shifter == null) return wall;
    const fromMeter = Math.min(D, gateHeardSourceSeconds(shifter.timePlayed));
    return Math.min(wall, fromMeter);
  }

  let stopped = false;
  let currentSource: AudioBufferSourceNode | null = null;
  let pitchTailVoice: GainNode | null = null;
  let pitchTailShifter: PitchShifter | null = null;
  let currentDetachNode: ((releaseHard?: boolean) => void) | null = null;

  function fadePitchTail(hard: boolean): void {
    const v = pitchTailVoice;
    const s = pitchTailShifter;
    pitchTailVoice = null;
    pitchTailShifter = null;
    if (!v && !s) return;
    if (hard || !v) {
      try {
        s?.disconnect();
      } catch {
        /* ignore */
      }
      return;
    }
    const now = ctx.currentTime;
    try {
      v.gain.cancelScheduledValues(now);
      const c = Math.min(1, Math.max(0, v.gain.value));
      v.gain.setValueAtTime(c, now);
      v.gain.linearRampToValueAtTime(0, now + PITCH_TAIL_RELEASE_SEC);
    } catch {
      try {
        s?.disconnect();
      } catch {
        /* ignore */
      }
      return;
    }
    window.setTimeout(() => {
      try {
        s?.disconnect();
      } catch {
        /* ignore */
      }
    }, Math.ceil(PITCH_TAIL_RELEASE_SEC * 1000) + 25);
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
    try {
      currentSource?.stop(0);
    } catch {
      /* ignore */
    }
    currentSource = null;
    try {
      currentDetachNode?.(true);
    } catch {
      /* ignore */
    }
    currentDetachNode = null;
    fadePitchTail(true);
    try {
      void ctx.close();
    } catch {
      /* ignore */
    }
  };

  activeBySessionId.set(sessionId, { kind: "wa", dispose });

  const reverseBuf = reverse ? reverseAudioBuffer(ctx, forward) : null;
  const playBuf = reverse && !pendulum && reverseBuf ? reverseBuf : forward;

  function scheduleLoopTickIfNeeded(buf: AudioBuffer): void {
    if (!loopEnabled || !onLoopTick || pendulum) return;
    let lastWall = performance.now();
    const id = window.setInterval(() => {
      if (stopped) return;
      const now = performance.now();
      const lapMs = (buf.duration / effectiveRate) * 1000;
      if (lapMs > 0 && now - lastWall >= lapMs * 0.92) {
        onLoopTick();
        lastWall = now;
      }
    }, Math.min(420, Math.max(90, (buf.duration / effectiveRate / 4) * 1000)));
    loopTickCleanupBySessionId.set(sessionId, () => clearInterval(id));
  }

  function stopCurrentPlayback(): void {
    try {
      currentSource?.stop(0);
    } catch {
      /* ignore */
    }
    currentSource = null;
    try {
      currentDetachNode?.(false);
    } catch {
      /* ignore */
    }
    currentDetachNode = null;
  }

  function sliceBuffer(
    buffer: AudioBuffer,
    offsetSec: number,
    durationSec?: number,
  ): AudioBuffer {
    const startSec = Math.max(0, Math.min(buffer.duration, offsetSec));
    const remainingSec = Math.max(0, buffer.duration - startSec);
    const wantedSec =
      durationSec == null ? remainingSec : Math.max(0, Math.min(remainingSec, durationSec));
    const startFrame = Math.floor(startSec * buffer.sampleRate);
    /** +1 кадр: не обрезаем хвост сегмента из‑за ceil. */
    const frameCount = Math.max(1, Math.ceil(wantedSec * buffer.sampleRate) + 1);
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

  function withTrailingSilence(buffer: AudioBuffer, tailSec: number): AudioBuffer {
    const addFrames = Math.max(1, Math.ceil(Math.max(0, tailSec) * buffer.sampleRate));
    const out = ctx.createBuffer(
      buffer.numberOfChannels,
      buffer.length + addFrames,
      buffer.sampleRate,
    );
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      out.getChannelData(c).set(buffer.getChannelData(c), 0);
    }
    return out;
  }

  function playWithPitchShifter(
    buffer: AudioBuffer,
    loopThis: boolean,
    onDone: () => void,
    onLoopLap?: () => void,
    expectedOutSec?: number,
    shifterOpts?: {
      onShifterReady?: (s: PitchShifter) => void;
      bufferSize?: number;
    },
  ): void {
    if (stopped) return;
    stopCurrentPlayback();
    let shifter: PitchShifter | null = null;
    let alive = true;
    const startOne = () => {
      if (stopped || !alive) return;
      let endedHandled = false;
      let doneHandled = false;
      let doneTimer: ReturnType<typeof setTimeout> | null = null;
      const finishDone = () => {
        if (doneHandled || stopped || !alive) return;
        doneHandled = true;
        onDone();
      };
      const voiceGain = ctx.createGain();
      voiceGain.connect(gainNode);
      const t = ctx.currentTime;
      try {
        voiceGain.gain.cancelScheduledValues(t);
        voiceGain.gain.setValueAtTime(0, t);
        voiceGain.gain.linearRampToValueAtTime(1, t + PITCH_TAIL_RELEASE_SEC);
      } catch {
        voiceGain.gain.value = 1;
      }
      const shifterBufferSize = shifterOpts?.bufferSize ?? PITCH_SHIFT_DEFAULT_BUFFER_FRAMES;
      shifter = new PitchShifter(ctx, buffer, shifterBufferSize, () => {
        if (stopped || !alive || endedHandled) return;
        endedHandled = true;
        if (loopThis) {
          fadePitchTail(false);
          if (!alive) return;
          onLoopLap?.();
          startOne();
          return;
        }
        if (doneTimer != null) {
          clearTimeout(doneTimer);
          doneTimer = null;
        }
        fadePitchTail(false);
        const drainMs = Math.max(
          24,
          Math.ceil((shifterBufferSize / Math.max(1, ctx.sampleRate)) * 1000) + 24,
        );
        const tailMs = Math.ceil(PITCH_TAIL_RELEASE_SEC * 1000) + 30;
        if (!doneHandled) {
          doneTimer = window.setTimeout(() => finishDone(), drainMs + tailMs);
        }
      });
      shifter.rate = 1;
      shifter.tempo = speed;
      shifter.pitch = pitch;
      shifter.connect(voiceGain);
      shifterOpts?.onShifterReady?.(shifter);
      if (!loopThis) {
        const outSec = Math.max(0, expectedOutSec ?? buffer.duration / Math.max(0.001, speed));
        const safetyMs = 36;
        doneTimer = window.setTimeout(
          () => finishDone(),
          Math.ceil(outSec * 1000) + safetyMs,
        );
      }
      pitchTailVoice = voiceGain;
      pitchTailShifter = shifter;
      currentDetachNode = (releaseHard?: boolean) => {
        alive = false;
        if (doneTimer != null) {
          clearTimeout(doneTimer);
          doneTimer = null;
        }
        fadePitchTail(releaseHard === true);
      };
    };
    startOne();
  }

  function playBufferOnce(
    buffer: AudioBuffer,
    onDone: () => void,
    loopThis: boolean,
    options?: {
      offsetSec?: number;
      durationSec?: number;
      onLoopLap?: () => void;
      /** Без хвоста тишины — первый полупериод ping-pong, чтобы стык со вторым был без щели. */
      noTailPadding?: boolean;
      /** Сегмент сразу после предыдущего (без лишнего padding между половинами). */
      chainNext?: boolean;
      /** Меньше — ниже задержка ScriptProcessor (гейт / хвост), выше CPU. */
      pitchBufferSize?: number;
      /** Хвост тишины для SoundTouch даже при chainNext (хвост после гейта — не обрезать конец). */
      appendSoundTouchDrain?: boolean;
      onShifterReady?: (s: PitchShifter) => void;
    },
  ): void {
    if (stopped) return;
    const offsetSec = options?.offsetSec ?? 0;
    const durationSec = options?.durationSec;
    const onLoopLap = options?.onLoopLap;
    const rawSegment =
      offsetSec > 0 || durationSec != null
        ? sliceBuffer(buffer, offsetSec, durationSec)
        : buffer;
    const isReverseSegment = reverseBuf != null && buffer === reverseBuf;
    const padTailSec = soundTouchTailPaddingSec(speed, pitch, isReverseSegment);
    const chainNext = Boolean(options?.chainNext);
    const noTailPadding = Boolean(options?.noTailPadding);
    const appendSoundTouchDrain = Boolean(options?.appendSoundTouchDrain);
    const shouldPad =
      !loopThis &&
      (appendSoundTouchDrain || (!noTailPadding && !chainNext));
    const segment = loopThis || !shouldPad ? rawSegment : withTrailingSilence(rawSegment, padTailSec);
    const expectedOutSec = segment.duration / Math.max(0.001, speed);
    const expectedOutSecWithReverseSafety = expectedOutSec + (isReverseSegment ? 0.12 : 0);
    playWithPitchShifter(
      segment,
      loopThis,
      onDone,
      onLoopLap,
      expectedOutSecWithReverseSafety,
      {
        bufferSize: options?.pitchBufferSize,
        onShifterReady: options?.onShifterReady,
      },
    );
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

  if (gateEnabled && pendulum && reverse && reverseBuf) {
    let reverseExhausted = false;
    let userReleased = false;
    const t0 = ctx.currentTime;
    let gateRevHoldShifter: PitchShifter | null = null;

    let tailStarted = false;

    /** После удержания на реверсе — добираем вперёд до конца файла (уже не reverse-буфер). */
    function playForwardTailAfterReverseHold(playedRevSec: number): void {
      if (stopped || tailStarted) return;
      tailStarted = true;
      const played = Math.min(D, Math.max(0, playedRevSec));
      if (played < 0.02) {
        cleanupSession(sessionId);
        return;
      }
      const offFwd = D - played;
      const durFwd = played;
      if (durFwd < 0.02) {
        cleanupSession(sessionId);
        return;
      }
      playBufferOnce(forward, () => cleanupSession(sessionId), false, {
        offsetSec: offFwd,
        durationSec: durFwd,
        chainNext: true,
        appendSoundTouchDrain: true,
        pitchBufferSize: GATE_PITCH_SHIFT_BLOCK_FRAMES,
      });
    }

    gatePendReleaseBySessionId.set(sessionId, () => {
      if (stopped) return;
      if (userReleased) {
        cleanupSession(sessionId);
        return;
      }
      userReleased = true;
      const playedWall = ctx.currentTime - t0;
      const wallPlayed = Math.min(D, Math.max(0, playedWall * effectiveRate));
      const playedRev = reverseExhausted
        ? D
        : mergeGateHoldPlayedSec(wallPlayed, gateRevHoldShifter);
      gateRevHoldShifter = null;
      stopCurrentPlayback();
      stopSoundBarEmojiGate(sessionId);
      playForwardTailAfterReverseHold(playedRev);
    });

    playBufferOnce(
      reverseBuf,
      () => {
        reverseExhausted = true;
        gateRevHoldShifter = null;
      },
      false,
      {
        pitchBufferSize: GATE_PITCH_SHIFT_BLOCK_FRAMES,
        onShifterReady: (s) => {
          gateRevHoldShifter = s;
        },
      },
    );
    return;
  }

  if (gateEnabled && pendulum) {
    let forwardExhausted = false;
    let userReleased = false;
    const t0 = ctx.currentTime;
    const revFull = reverseAudioBuffer(ctx, forward);
    let gateFwdHoldShifter: PitchShifter | null = null;

    let tailStarted = false;

    function playReverseFromPlayedSeconds(playedSec: number): void {
      if (stopped || tailStarted) return;
      tailStarted = true;
      const played = Math.min(D, Math.max(0, playedSec));
      if (played < 0.02) {
        cleanupSession(sessionId);
        return;
      }
      const off = Math.max(0, D - played);
      playBufferOnce(revFull, () => cleanupSession(sessionId), false, {
        offsetSec: off,
        durationSec: played,
        chainNext: true,
        appendSoundTouchDrain: true,
        pitchBufferSize: GATE_PITCH_SHIFT_BLOCK_FRAMES,
      });
    }

    gatePendReleaseBySessionId.set(sessionId, () => {
      if (stopped) return;
      if (userReleased) {
        cleanupSession(sessionId);
        return;
      }
      userReleased = true;
      const playedWall = ctx.currentTime - t0;
      const wallPlayed = Math.min(D, Math.max(0, playedWall * effectiveRate));
      const playedSec = forwardExhausted
        ? D
        : mergeGateHoldPlayedSec(wallPlayed, gateFwdHoldShifter);
      gateFwdHoldShifter = null;
      stopCurrentPlayback();
      stopSoundBarEmojiGate(sessionId);
      playReverseFromPlayedSeconds(playedSec);
    });

    playBufferOnce(
      forward,
      () => {
        forwardExhausted = true;
        gateFwdHoldShifter = null;
      },
      false,
      {
        pitchBufferSize: GATE_PITCH_SHIFT_BLOCK_FRAMES,
        onShifterReady: (s) => {
          gateFwdHoldShifter = s;
        },
      },
    );
    return;
  }

  if (gateEnabled && reverse && reverseBuf && !pendulum) {
    playBufferOnce(reverseBuf, () => finishNatural(), false);
    return;
  }

  if (loopEnabled && pendulum && !gateEnabled) {
    const revFull = reverseAudioBuffer(ctx, forward);
    function playPingPongCycle(fromReverse: boolean): void {
      if (stopped) return;
      playBufferOnce(
        forward,
        () => {
          if (stopped) return;
          playBufferOnce(
            revFull,
            () => {
              if (stopped) return;
              onLoopTick?.();
              playPingPongCycle(true);
            },
            false,
            { chainNext: true },
          );
        },
        false,
        fromReverse ? { chainNext: true } : { noTailPadding: true },
      );
    }
    playPingPongCycle(false);
    return;
  }

  if (pendulum && !gateEnabled) {
    playBufferOnce(
      forward,
      () => {
        if (stopped) return;
        const revB = reverseAudioBuffer(ctx, forward);
        playBufferOnce(
          revB,
          () => {
            cleanupSession(sessionId);
          },
          false,
          { chainNext: true },
        );
      },
      false,
      { noTailPadding: true },
    );
    return;
  }

  if (loopEnabled) {
    playBufferOnce(playBuf, () => {}, true, { onLoopLap: onLoopTick });
    if (pitch === 1) scheduleLoopTickIfNeeded(playBuf);
    return;
  }

  playBufferOnce(playBuf, () => finishNatural(), false);
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
  } = params;

  clearSessionCancelled(sessionId);
  if (activeBySessionId.has(sessionId)) cleanupSession(sessionId);

  const gateEnabled = Boolean(params.gateEnabled);
  const reverseEff = Boolean(reverse) && (!pendulum || gateEnabled);
  const merged: SoundBarPlaybackStartParams = {
    ...params,
    playbackPitch: clampPlaybackPitch(playbackPitch),
    reverse: reverseEff,
  };

  const speed = clampPlaybackSpeed(params.playbackSpeed);
  const effectiveRate = speed;

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

  const useWebAudio =
    pendulum || reverseEff || merged.sessionVolume > 1 || merged.playbackPitch !== 1;

  if (!useWebAudio) {
    if (isSessionCancelled(sessionId)) {
      cleanupSession(sessionId);
      return;
    }
    await startHtmlSoundBarSession(sessionId, merged);
    return;
  }

  try {
    const forward = await decodeSoundBarUrl(trimmed);
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
  cleanupSession(sessionId);
}
