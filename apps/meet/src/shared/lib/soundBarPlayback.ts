import { applyStoredOutputDevice } from "./audio-devices";
import { getOutputMuted } from "./output-mute";

type SessionId = string;

const activeBySessionId = new Map<SessionId, HTMLAudioElement>();
const onEndedBySessionId = new Map<SessionId, () => void>();

function cleanupSession(sessionId: SessionId): void {
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

export async function startSoundBarSession(params: {
  sessionId: SessionId;
  audioUrl: string;
  loopEnabled: boolean;
  onEnded?: () => void;
}): Promise<void> {
  const { sessionId, audioUrl, loopEnabled, onEnded } = params;

  if (getOutputMuted()) {
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
  audio.volume = 1;

  activeBySessionId.set(sessionId, audio);

  // Ensure correct output device when possible.
  void applySink(audio);

  // Cleanup after natural end.
  audio.addEventListener("ended", () => cleanupSession(sessionId), { once: true });
  audio.addEventListener("error", () => cleanupSession(sessionId), { once: true });

  try {
    await audio.play();
  } catch {
    // Autoplay restrictions: ignore, session will still exist until stop/ended.
  }
}

export function stopSoundBarSession(sessionId: SessionId): void {
  cleanupSession(sessionId);
}

