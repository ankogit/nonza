import { getStoredAudioOutputDevice } from "./audio-devices";
import { getOutputMuted } from "./output-mute";

const DEFAULT_VOLUME = 0.8;

let decodeContext: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();
const inFlightDecodes = new Map<string, Promise<AudioBuffer>>();

function getDecodeContext(): AudioContext {
  if (!decodeContext) decodeContext = new AudioContext();
  return decodeContext;
}

async function decodeUrl(url: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(url);
  if (cached) return cached;

  const existing = inFlightDecodes.get(url);
  if (existing) return existing;

  const promise = (async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await getDecodeContext().decodeAudioData(arrayBuffer);
    bufferCache.set(url, buffer);
    inFlightDecodes.delete(url);
    return buffer;
  })();

  inFlightDecodes.set(url, promise);
  return promise;
}

async function createPlaybackContext(): Promise<AudioContext> {
  const ctx = new AudioContext();
  await ctx.resume();

  const setSink = (
    ctx as unknown as { setSinkId?: (id: string) => Promise<void> }
  ).setSinkId;

  if (typeof setSink === "function") {
    const deviceId = getStoredAudioOutputDevice();
    try {
      await setSink.call(ctx, deviceId || "");
    } catch {
      /* ignore */
    }
  }

  return ctx;
}

async function playBuffer(
  ctx: AudioContext,
  buffer: AudioBuffer,
  opts?: { startMs?: number; endMs?: number; volume?: number },
): Promise<void> {
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gainNode = ctx.createGain();
  gainNode.gain.value = (opts?.volume ?? DEFAULT_VOLUME) * (getOutputMuted() ? 0 : 1);

  source.connect(gainNode);
  gainNode.connect(ctx.destination);

  const startSec = typeof opts?.startMs === "number" ? opts.startMs / 1000 : 0;
  const endSec =
    typeof opts?.endMs === "number" ? opts.endMs / 1000 : buffer.duration;
  const durationSec = Math.max(0, endSec - startSec);

  source.start(0, startSec, durationSec);
  source.onended = () => {
    void ctx.close().catch(() => {});
  };
}

export async function playAudioUrl(
  url: string,
  opts?: { startMs?: number; endMs?: number; volume?: number },
): Promise<void> {
  if (getOutputMuted()) return;
  const trimmed = url.trim();
  if (!trimmed) return;

  const buffer = await decodeUrl(trimmed);
  const ctx = await createPlaybackContext();
  await playBuffer(ctx, buffer, opts);
}

