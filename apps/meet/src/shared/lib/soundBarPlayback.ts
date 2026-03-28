import { applyStoredOutputDevice } from "./audio-devices";
import { getOutputMuted } from "./output-mute";
import { subscribeSoundBarVolume } from "./soundBarVolume";

type SessionId = string;

const activeBySessionId = new Map<SessionId, HTMLAudioElement>();
const unsubscribeMasterBySessionId = new Map<SessionId, () => void>();
const onEndedBySessionId = new Map<SessionId, () => void>();
const loopTickCleanupBySessionId = new Map<SessionId, () => void>();
const playbackReadyFallbackBySessionId = new Map<
  SessionId,
  ReturnType<typeof setTimeout>
>();

function clearPlaybackReadyFallback(sessionId: SessionId): void {
  const t = playbackReadyFallbackBySessionId.get(sessionId);
  if (t != null) {
    clearTimeout(t);
    playbackReadyFallbackBySessionId.delete(sessionId);
  }
}

function cleanupSession(sessionId: SessionId): void {
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

  const a = activeBySessionId.get(sessionId);
  if (a) {
    activeBySessionId.delete(sessionId);

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
  }

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

const FALLBACK_CLIP_DURATION_SEC = 2.5;

function clampClipDurationSec(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return FALLBACK_CLIP_DURATION_SEC;
  return Math.min(60, Math.max(0.12, raw));
}

export async function startSoundBarSession(params: {
  sessionId: SessionId;
  audioUrl: string;
  loopEnabled: boolean;
  onEnded?: () => void;
  onLoopTick?: () => void;
  onPlaybackReady?: (info: { durationSec: number }) => void;
  onGateNonLoopClipEnded?: () => void;
}): Promise<void> {
  const {
    sessionId,
    audioUrl,
    loopEnabled,
    onEnded,
    onLoopTick,
    onPlaybackReady,
    onGateNonLoopClipEnded,
  } = params;

  if (getOutputMuted()) {
    onPlaybackReady?.({ durationSec: FALLBACK_CLIP_DURATION_SEC });
    onEnded?.();
    return;
  }
  const trimmed = audioUrl.trim();
  if (!trimmed) {
    onEnded?.();
    return;
  }

  // If session id was somehow reused, stop old playback first.
  if (activeBySessionId.has(sessionId)) cleanupSession(sessionId);

  if (onEnded) onEndedBySessionId.set(sessionId, onEnded);

  const audio = new Audio(trimmed);
  audio.preload = "auto";
  audio.loop = loopEnabled;

  unsubscribeMasterBySessionId.set(
    sessionId,
    subscribeSoundBarVolume((v) => {
      audio.volume = v;
    }),
  );

  activeBySessionId.set(sessionId, audio);

  let playbackReadyFired = false;
  function firePlaybackReadyOnce(): void {
    if (playbackReadyFired) return;
    const d = audio.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    playbackReadyFired = true;
    clearPlaybackReadyFallback(sessionId);
    onPlaybackReady?.({ durationSec: clampClipDurationSec(d) });
  }

  audio.addEventListener("loadedmetadata", firePlaybackReadyOnce);
  audio.addEventListener("durationchange", firePlaybackReadyOnce);

  const fallbackTimer = window.setTimeout(() => {
    if (playbackReadyFired) return;
    playbackReadyFired = true;
    playbackReadyFallbackBySessionId.delete(sessionId);
    onPlaybackReady?.({ durationSec: FALLBACK_CLIP_DURATION_SEC });
  }, 900);
  playbackReadyFallbackBySessionId.set(sessionId, fallbackTimer);

  // Ensure correct output device when possible.
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
    // Autoplay restrictions: ignore, session will still exist until stop/ended.
  }

  queueMicrotask(() => firePlaybackReadyOnce());
}

export function stopSoundBarSession(sessionId: SessionId): void {
  cleanupSession(sessionId);
}

