import {
  applyStoredOutputDevice,
  getStoredAudioOutputDevice,
} from "./audio-devices";
import {
  Context as ToneContext,
  PitchShift as TonePitchShift,
  connect as toneConnect,
} from "tone";
import { getOutputMuted } from "./output-mute";
import { stopSoundBarEmojiGate } from "./soundBarEmojiParticles";
import { subscribeSoundBarVolume } from "./soundBarVolume";
import { TimestretchWorklet } from "./audio/TimestretchWorklet";

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
      const buffer = await getDecodeContext().decodeAudioData(
        arrayBuffer.slice(0),
      );
      bufferCache.set(url, buffer);
      return buffer;
    } finally {
      inFlightDecodes.delete(url);
    }
  })();

  inFlightDecodes.set(url, promise);
  return await promise;
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
const MIN_AUDIBLE_SEGMENT_SEC = 0.02;
const NEUTRAL_PITCH_EPSILON = 0.01;
const PITCH_SHIFT_WINDOW_SEC = 0.14;
const PITCH_SHIFT_STAGE_LIMIT_SEMITONES = 8;
const PITCH_SHIFT_DRAIN_TAIL_MS = 220;
const SOURCE_ONLY_DRAIN_TAIL_MS = 40;
const MAX_PITCH_SHIFT_DRAIN_TAIL_MS = 5000;
const HARD_SAFE_PITCH_TAIL_MS = 600;

function closeAudioContextQuietly(ctx: AudioContext): void {
  try {
    void ctx.close();
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
  const { heardLapSec, heardTotalOnceSec } = heardTiming(
    durationSec,
    s,
    pendulum,
  );
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
  enablePitchPreservation(audio);
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
  const fullDurationSec = forward.duration;

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

  const toneCtx = new ToneContext({ context: ctx, lookAhead: 0 });
  const gainNode = ctx.createGain();
  gainNode.connect(ctx.destination);

  let stopped = false;
  let currentDisposeVoice: (() => void) | null = null;
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
    currentDisposeVoice?.();
    currentDisposeVoice = null;
    closeAudioContextQuietly(ctx);
  };

  activeBySessionId.set(sessionId, { kind: "wa", dispose });

  const reverseBuf = reverse ? reverseAudioBuffer(ctx, forward) : null;
  const playBuf = reverse && !pendulum && reverseBuf ? reverseBuf : forward;

  function stopCurrentPlayback(): void {
    currentLapCleanup?.();
    currentLapCleanup = null;
    currentDisposeVoice?.();
    currentDisposeVoice = null;
  }

  function stopPlaybackAndFinalizeSession(): void {
    stopCurrentPlayback();
    stopSoundBarEmojiGate(sessionId);
    cleanupSession(sessionId);
  }

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
    },
  ): void {
    if (stopped) return;
    stopCurrentPlayback();

    const offsetSec = Math.max(0, seg?.offsetSec ?? 0);
    const durationSec = seg?.durationSec;
    const hasSegmentWindow =
      offsetSec > 0 || (durationSec != null && durationSec < buffer.duration);
    const playBuffer = hasSegmentWindow
      ? sliceBufferSegment(buffer, offsetSec, durationSec)
      : buffer;

    const voiceGain = ctx.createGain();
    voiceGain.connect(gainNode);
    const now = ctx.currentTime;
    voiceGain.gain.setValueAtTime(0, now);
    voiceGain.gain.linearRampToValueAtTime(1, now + VOICE_FADE_SEC);

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
    const finalDrainTailMs = hasPitchShiftTail
      ? Math.max(pitchShiftDrainTailMs, HARD_SAFE_PITCH_TAIL_MS)
      : pitchShiftDrainTailMs;
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
        playWithSessionPipeline(buffer, true, onDone, onLoopLap, seg);
        return;
      }
      window.setTimeout(
        () => finishDone(),
        finalDrainTailMs,
      );
    };
    const source = ctx.createBufferSource();
    source.buffer = playBuffer;
    source.loop = false;
    source.playbackRate.value = speed;
    setCurrentSegmentClock(offsetSec);

    let worklet: TimestretchWorklet | null = null;
    let pitchShiftNodes: TonePitchShift[] = [];
    let disposed = false;
    let started = false;

    void TimestretchWorklet.createWorklet({
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
    })
      .then((w) => {
        if (stopped || disposed) {
          try {
            w.workletNode?.disconnect();
          } catch {
            /* ignore */
          }
          return;
        }
        worklet = w;
        w.updateSpeed(speed);
        w.updatePitch(1);

        if (Math.abs(compensatedPitchRatio - 1) <= NEUTRAL_PITCH_EPSILON) {
          w.workletNode?.connect(voiceGain);
        } else {
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
          if (pitchShiftNodes.length > 0) {
            toneConnect(
              w.workletNode as unknown as AudioNode,
              pitchShiftNodes[0],
            );
            for (let i = 1; i < pitchShiftNodes.length; i++) {
              toneConnect(pitchShiftNodes[i - 1], pitchShiftNodes[i]);
            }
            toneConnect(
              pitchShiftNodes[pitchShiftNodes.length - 1],
              voiceGain as unknown as AudioNode,
            );
          } else {
            w.workletNode?.connect(voiceGain);
          }
        }

        source.start();
        started = true;
      })
      .catch(() => {
        if (stopped || disposed) return;
        cleanupSession(sessionId);
      });

    source.onended = () => {
      if (stopped || disposed) return;
      onVoiceStop();
    };

    currentDisposeVoice = () => {
      if (disposed) return;
      disposed = true;
      const t = ctx.currentTime;
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
        () => {
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
        },
        Math.ceil((VOICE_FADE_SEC + 0.02) * 1000),
      );
    };

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
      playWithSessionPipeline(playBuf, true, () => {}, onLoopTick);
    } else {
      playWithSessionPipeline(playBuf, false, () => finishNatural());
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
      stopCurrentPlayback();
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
      stopCurrentPlayback();
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

    playWithSessionPipeline(reverseOnlyBuffer, false, () => finishNatural());
    return;
  }

  if (loopEnabled && pendulum && !gateEnabled) {
    const revFull = reverseAudioBuffer(ctx, forward);
    function playPingPongCycle(): void {
      if (stopped) return;
      playWithSessionPipeline(forward, false, () => {
        if (stopped) return;
        playWithSessionPipeline(revFull, false, () => {
          if (stopped) return;
          onLoopTick?.();
          playPingPongCycle();
        });
      });
    }
    playPingPongCycle();
    return;
  }

  if (pendulum && !gateEnabled) {
    playWithSessionPipeline(forward, false, () => {
      if (stopped) return;
      const revB = reverseAudioBuffer(ctx, forward);
      playWithSessionPipeline(revB, false, () => {
        cleanupSession(sessionId);
      });
    });
    return;
  }

  if (loopEnabled) {
    playWithSessionPipeline(playBuf, true, () => {}, onLoopTick);
    return;
  }

  playWithSessionPipeline(playBuf, false, () => finishNatural());
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
  if (isNeutralPitch(merged.playbackPitch)) {
    merged.playbackPitch = 1;
  }

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
