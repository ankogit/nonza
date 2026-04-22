import {
  applyStoredOutputDevice,
  getStoredAudioOutputDevice,
} from "./audio-devices";
import { getOutputMuted } from "./output-mute";
import { stopSoundBarEmojiGate } from "./soundBarEmojiParticles";
import { subscribeSoundBarVolume } from "./soundBarVolume";

type SessionId = string;

type SessionHandle =
  | { kind: "html"; audio: HTMLAudioElement }
  | { kind: "wa"; dispose: () => void };

const activeBySessionId = new Map<SessionId, SessionHandle>();

/** gate+pendulum: pointer-up triggers tail before full cleanupSession */
const gatePendReleaseBySessionId = new Map<SessionId, () => void>();
const unsubscribeMasterBySessionId = new Map<SessionId, () => void>();
const onEndedBySessionId = new Map<SessionId, () => void>();
const loopTickCleanupBySessionId = new Map<SessionId, () => void>();
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

const FALLBACK_CLIP_DURATION_SEC = 2.5;

function clampClipDurationSec(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return FALLBACK_CLIP_DURATION_SEC;
  return Math.min(60, Math.max(0.12, raw));
}

function clampSessionVolume(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.max(0, Math.min(1, v));
}

function clampPlaybackSpeed(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.max(0.25, Math.min(4, v));
}

export type SoundBarPlaybackReadyInfo = {
  durationSec: number;
  heardLapSec: number;
  heardTotalOnceSec: number;
};

function heardTiming(
  baseSec: number,
  speed: number,
  pendulum: boolean,
): { heardLapSec: number; heardTotalOnceSec: number } {
  const lap = baseSec / speed;
  return {
    heardLapSec: lap,
    heardTotalOnceSec: pendulum ? lap * 2 : lap,
  };
}

function fireReady(
  sessionId: SessionId,
  baseSec: number,
  speed: number,
  pendulum: boolean,
  onPlaybackReady?: (info: SoundBarPlaybackReadyInfo) => void,
): void {
  clearPlaybackReadyFallback(sessionId);
  const durationSec = clampClipDurationSec(baseSec);
  const s = clampPlaybackSpeed(speed);
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

  const audio = new Audio(trimmed);
  audio.preload = "auto";
  audio.loop = loopEnabled;
  audio.playbackRate = speed;

  unsubscribeMasterBySessionId.set(
    sessionId,
    subscribeSoundBarVolume((v) => {
      audio.volume = v * volMul;
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
    fireReady(sessionId, base, speed, params.pendulum, onPlaybackReady);
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
      speed,
      params.pendulum,
      onPlaybackReady,
    );
  }, 900);
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
    reverse,
    onLoopTick,
    onPlaybackReady,
    onGateNonLoopClipEnded,
  } = params;

  const volMul = clampSessionVolume(sessionVolume);
  const speed = clampPlaybackSpeed(playbackSpeed);
  const baseSec = clampClipDurationSec(forward.duration);
  const D = forward.duration;

  let ctx: AudioContext;
  try {
    ctx = new AudioContext({ sampleRate: forward.sampleRate });
  } catch {
    ctx = new AudioContext();
  }
  await ctx.resume();
  await applySinkToAudioContext(ctx);

  const gainNode = ctx.createGain();
  gainNode.connect(ctx.destination);

  let stopped = false;
  let currentSource: AudioBufferSourceNode | null = null;

  const setGainFromMaster = (master: number) => {
    if (stopped || gainNode.context.state === "closed") return;
    try {
      gainNode.gain.setValueAtTime(master * volMul, ctx.currentTime);
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
      const lapMs = (buf.duration / speed) * 1000;
      if (lapMs > 0 && now - lastWall >= lapMs * 0.92) {
        onLoopTick();
        lastWall = now;
      }
    }, Math.min(420, Math.max(90, (buf.duration / speed / 4) * 1000)));
    loopTickCleanupBySessionId.set(sessionId, () => clearInterval(id));
  }

  function applyPlaybackRate(src: AudioBufferSourceNode, r: number): void {
    const t = ctx.currentTime;
    try {
      src.playbackRate.cancelScheduledValues(t);
      src.playbackRate.setValueAtTime(r, t);
    } catch {
      src.playbackRate.value = r;
    }
    try {
      src.detune.setValueAtTime(0, t);
    } catch {
      /* ignore */
    }
  }

  function playBufferOnce(
    buffer: AudioBuffer,
    onDone: () => void,
    loopThis: boolean,
  ): void {
    if (stopped) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    applyPlaybackRate(src, speed);
    src.loop = loopThis;
    src.connect(gainNode);
    currentSource = src;
    src.onended = () => {
      if (currentSource === src) currentSource = null;
      if (!stopped) onDone();
    };
    try {
      src.start(0);
    } catch {
      onGateNonLoopClipEnded?.();
      cleanupSession(sessionId);
    }
  }

  function finishNatural(): void {
    onGateNonLoopClipEnded?.();
    cleanupSession(sessionId);
  }

  fireReady(sessionId, baseSec, speed, pendulum && !gateEnabled, onPlaybackReady);

  if (gateEnabled && pendulum && reverse && reverseBuf) {
    let reverseExhausted = false;
    let userReleased = false;
    const t0 = ctx.currentTime;

    let tailStarted = false;

    /** After reverse hold: play **forward** from stop position to end (not more reverse buffer). */
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
      const src = ctx.createBufferSource();
      src.buffer = forward;
      applyPlaybackRate(src, speed);
      src.connect(gainNode);
      currentSource = src;
      src.onended = () => {
        if (currentSource === src) currentSource = null;
        if (!stopped) cleanupSession(sessionId);
      };
      try {
        src.start(0, offFwd, durFwd);
      } catch {
        cleanupSession(sessionId);
      }
    }

    gatePendReleaseBySessionId.set(sessionId, () => {
      if (stopped) return;
      if (userReleased) {
        cleanupSession(sessionId);
        return;
      }
      userReleased = true;
      try {
        currentSource?.stop(0);
      } catch {
        /* ignore */
      }
      currentSource = null;
      const playedWall = ctx.currentTime - t0;
      const playedRev = reverseExhausted
        ? D
        : Math.min(D, Math.max(0, playedWall * speed));
      playForwardTailAfterReverseHold(playedRev);
    });

    const rev = ctx.createBufferSource();
    rev.buffer = reverseBuf;
    applyPlaybackRate(rev, speed);
    rev.connect(gainNode);
    currentSource = rev;
    rev.onended = () => {
      if (currentSource === rev) currentSource = null;
      reverseExhausted = true;
    };
    try {
      rev.start(0);
    } catch {
      gatePendReleaseBySessionId.delete(sessionId);
      cleanupSession(sessionId);
    }
    return;
  }

  if (gateEnabled && pendulum) {
    let forwardExhausted = false;
    let userReleased = false;
    const t0 = ctx.currentTime;
    const revFull = reverseAudioBuffer(ctx, forward);

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
      const src = ctx.createBufferSource();
      src.buffer = revFull;
      applyPlaybackRate(src, speed);
      src.connect(gainNode);
      currentSource = src;
      src.onended = () => {
        if (currentSource === src) currentSource = null;
        if (!stopped) cleanupSession(sessionId);
      };
      try {
        src.start(0, off, played);
      } catch {
        cleanupSession(sessionId);
      }
    }

    gatePendReleaseBySessionId.set(sessionId, () => {
      if (stopped) return;
      if (userReleased) {
        cleanupSession(sessionId);
        return;
      }
      userReleased = true;
      try {
        currentSource?.stop(0);
      } catch {
        /* ignore */
      }
      currentSource = null;
      const playedWall = ctx.currentTime - t0;
      const playedSec = forwardExhausted
        ? D
        : Math.min(D, Math.max(0, playedWall * speed));
      playReverseFromPlayedSeconds(playedSec);
    });

    const fwd = ctx.createBufferSource();
    fwd.buffer = forward;
    applyPlaybackRate(fwd, speed);
    fwd.connect(gainNode);
    currentSource = fwd;
    fwd.onended = () => {
      if (currentSource === fwd) currentSource = null;
      forwardExhausted = true;
    };
    try {
      fwd.start(0);
    } catch {
      gatePendReleaseBySessionId.delete(sessionId);
      cleanupSession(sessionId);
    }
    return;
  }

  if (gateEnabled && reverse && reverseBuf && !pendulum) {
    playBufferOnce(reverseBuf, () => {}, true);
    return;
  }

  if (loopEnabled && pendulum && !gateEnabled) {
    const revFull = reverseAudioBuffer(ctx, forward);
    function playPingPongCycle(): void {
      if (stopped) return;
      playBufferOnce(forward, () => {
        if (stopped) return;
        playBufferOnce(revFull, () => {
          if (stopped) return;
          onLoopTick?.();
          playPingPongCycle();
        }, false);
      }, false);
    }
    fireReady(sessionId, baseSec, speed, true, onPlaybackReady);
    playPingPongCycle();
    return;
  }

  if (pendulum && !gateEnabled) {
    playBufferOnce(forward, () => {
      if (stopped) return;
      const revB = reverseAudioBuffer(ctx, forward);
      playBufferOnce(revB, () => {
        cleanupSession(sessionId);
      }, false);
    }, false);
    return;
  }

  if (loopEnabled) {
    playBufferOnce(playBuf, () => {}, true);
    scheduleLoopTickIfNeeded(playBuf);
    return;
  }

  playBufferOnce(playBuf, () => finishNatural(), false);
}

export async function startSoundBarSession(
  params: SoundBarPlaybackStartParams,
): Promise<void> {
  const { sessionId, audioUrl, pendulum, reverse, onEnded, onPlaybackReady } = params;

  if (activeBySessionId.has(sessionId)) cleanupSession(sessionId);

  const gateEnabled = Boolean(params.gateEnabled);
  const reverseEff = Boolean(reverse) && (!pendulum || gateEnabled);
  const merged: SoundBarPlaybackStartParams = {
    ...params,
    reverse: reverseEff,
  };

  const speed = clampPlaybackSpeed(params.playbackSpeed);

  if (getOutputMuted()) {
    fireReady(
      sessionId,
      FALLBACK_CLIP_DURATION_SEC,
      speed,
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

  const useWebAudio = pendulum || reverseEff;

  if (!useWebAudio) {
    await startHtmlSoundBarSession(sessionId, merged);
    return;
  }

  try {
    const forward = await decodeSoundBarUrl(trimmed);
    await startWebAudioSoundBarSession(sessionId, merged, forward);
  } catch {
    await startHtmlSoundBarSession(sessionId, {
      ...merged,
      reverse: false,
      pendulum: false,
    });
  }
}

export function stopSoundBarSession(sessionId: SessionId): void {
  const release = gatePendReleaseBySessionId.get(sessionId);
  if (release) {
    release();
    return;
  }
  cleanupSession(sessionId);
}
