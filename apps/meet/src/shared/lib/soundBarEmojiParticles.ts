const FONT_STACK =
  '"Apple Color Emoji","Segoe UI Emoji",NotoColorEmoji,"Segoe UI Symbol","Android Emoji",EmojiSymbols,sans-serif';

const DEFAULT_CLIP_DURATION_SEC = 2.5;

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let rafId: number | null = null;

type Particle = {
  symbol: string;
  size: number;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  durX: number;
  durY: number;
  t0: number;
};

const particles: Particle[] = [];
const gateIntervalsBySessionId = new Map<string, ReturnType<typeof setInterval>>();
const emitIntervalsBySessionId = new Map<
  string,
  Set<ReturnType<typeof setInterval>>
>();

function trackEmitInterval(
  sessionId: string,
  id: ReturnType<typeof setInterval>,
): void {
  let set = emitIntervalsBySessionId.get(sessionId);
  if (!set) {
    set = new Set();
    emitIntervalsBySessionId.set(sessionId, set);
  }
  set.add(id);
}

function forgetEmitInterval(
  sessionId: string,
  id: ReturnType<typeof setInterval>,
): void {
  emitIntervalsBySessionId.get(sessionId)?.delete(id);
}

function clearEmitIntervalsForSession(sessionId: string): void {
  const set = emitIntervalsBySessionId.get(sessionId);
  if (!set) return;
  for (const id of set) {
    clearInterval(id);
  }
  emitIntervalsBySessionId.delete(sessionId);
}

export function stopAllSoundBarEmojiEffects(): void {
  for (const set of emitIntervalsBySessionId.values()) {
    for (const id of set) {
      clearInterval(id);
    }
  }
  emitIntervalsBySessionId.clear();
  for (const id of gateIntervalsBySessionId.values()) {
    clearInterval(id);
  }
  gateIntervalsBySessionId.clear();
  particles.length = 0;
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function cubicIn(t: number): number {
  return t * t * t;
}

function sinusoidalInOut(t: number): number {
  return -0.5 * (Math.cos(Math.PI * t) - 1);
}

function clampClipDurationSec(sec: number): number {
  if (!Number.isFinite(sec) || sec <= 0) return DEFAULT_CLIP_DURATION_SEC;
  return Math.min(45, Math.max(0.12, sec));
}

function ensureCanvas(): void {
  if (canvas) return;
  canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:10050";
  document.body.appendChild(canvas);
  ctx = canvas.getContext("2d");
  syncCanvasSize();
}

function syncCanvasSize(): void {
  if (!canvas) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function spawnParticle(symbol: string): void {
  if (!canvas) return;
  const w = canvas.width;
  const h = canvas.height;
  const size = Math.floor(Math.random() * 20) + 10;
  const sx = Math.floor(w * (-0.2 + Math.random() * 1.4));
  const sy = h * 1.2;
  const ex = Math.floor(w * (-0.2 + Math.random() * 1.4));
  const ey = -h * 0.2;
  particles.push({
    symbol,
    size,
    sx,
    sy,
    ex,
    ey,
    durX: 3000 * (0.5 + Math.random()),
    durY: 3000 * (0.5 + Math.random()),
    t0: performance.now(),
  });
}

function spawnMany(symbol: string, count: number): void {
  for (let i = 0; i < count; i++) {
    spawnParticle(symbol);
  }
}

function frame(now: number): void {
  syncCanvasSize();
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    const elapsed = now - p.t0;
    const tx = Math.min(1, elapsed / p.durX);
    const ty = Math.min(1, elapsed / p.durY);
    const x = p.sx + (p.ex - p.sx) * cubicIn(tx);
    const y = p.sy + (p.ey - p.sy) * sinusoidalInOut(ty);

    ctx.font = `${p.size}px ${FONT_STACK}`;
    ctx.fillText(p.symbol, x - 15, y - 15);

    if (tx >= 1) {
      particles.splice(i, 1);
    }
  }

  if (particles.length > 0) {
    rafId = requestAnimationFrame(frame);
  } else {
    rafId = null;
  }
}

function scheduleFrame(): void {
  if (rafId != null) return;
  rafId = requestAnimationFrame(frame);
}

function emitOverWindow(
  symbol: string,
  durationSec: number,
  densityFactor: number,
  sessionId: string,
): void {
  ensureCanvas();
  if (!canvas) return;

  const d = clampClipDurationSec(durationSec);
  const emitMs = Math.min(60000, Math.max(200, d * 1000));
  const totalParticles = Math.min(
    28,
    Math.max(4, Math.round((3 + d * 3.2) * densityFactor)),
  );
  const tickMs = Math.min(
    420,
    Math.max(85, emitMs / Math.max(10, totalParticles / 5)),
  );
  const ticks = Math.max(1, Math.ceil(emitMs / tickMs));
  const basePerTick = Math.max(1, Math.ceil(totalParticles / ticks));
  const start = performance.now();

  const emitTick = () => {
    if (performance.now() - start >= emitMs) {
      return false;
    }
    const n = Math.max(1, Math.round(basePerTick * (0.45 + Math.random() * 0.45)));
    spawnMany(symbol, n);
    scheduleFrame();
    return true;
  };

  emitTick();
  const id = window.setInterval(() => {
    if (!emitTick()) {
      clearInterval(id);
      forgetEmitInterval(sessionId, id);
    }
  }, tickMs);
  trackEmitInterval(sessionId, id);

  scheduleFrame();
}

export function triggerSoundBarEmojiBurst(
  symbol: string,
  durationSec: number = DEFAULT_CLIP_DURATION_SEC,
  sessionId: string,
): void {
  if (!symbol.trim()) return;
  const d = clampClipDurationSec(durationSec);
  emitOverWindow(symbol, d, 1, sessionId);
}

export function triggerSoundBarEmojiLoopIntro(
  symbol: string,
  durationSec: number = DEFAULT_CLIP_DURATION_SEC,
  sessionId: string,
): void {
  if (!symbol.trim()) return;
  const d = clampClipDurationSec(durationSec);
  emitOverWindow(symbol, d * 0.42, 0.55, sessionId);
}

export function triggerSoundBarEmojiLoopPulse(
  symbol: string,
  durationSec: number = DEFAULT_CLIP_DURATION_SEC,
): void {
  if (!symbol.trim()) return;
  ensureCanvas();
  if (!canvas) return;
  const d = clampClipDurationSec(durationSec);
  const n = Math.min(7, Math.max(1, Math.round(1 + d * 2.8)));
  spawnMany(symbol, n);
  scheduleFrame();
}

export function startSoundBarEmojiGate(
  sessionId: string,
  symbol: string,
  durationSec: number = DEFAULT_CLIP_DURATION_SEC,
): void {
  if (!symbol.trim()) return;
  stopSoundBarEmojiGate(sessionId);
  ensureCanvas();
  if (!canvas) return;

  const d = clampClipDurationSec(durationSec);
  const intervalMs = Math.min(520, Math.max(220, (d * 1000) / 11));
  const spawnCount = Math.min(5, Math.max(2, Math.round(2 + d * 0.22)));

  const id = window.setInterval(() => {
    spawnMany(symbol, spawnCount);
    scheduleFrame();
  }, intervalMs);

  gateIntervalsBySessionId.set(sessionId, id);
  scheduleFrame();
}

export function stopSoundBarEmojiGate(sessionId: string): void {
  clearEmitIntervalsForSession(sessionId);
  const id = gateIntervalsBySessionId.get(sessionId);
  if (id != null) {
    clearInterval(id);
    gateIntervalsBySessionId.delete(sessionId);
  }
}
