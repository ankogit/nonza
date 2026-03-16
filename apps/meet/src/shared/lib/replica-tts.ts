let cachedVoice: SpeechSynthesisVoice | null = null;
let voicesLoaded = false;

const pitchByIdentity = new Map<string, number>();

function pickRuVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const exactRu = voices.find((v) => v.lang === "ru-RU");
  if (exactRu) return exactRu;
  const startsWithRu = voices.find(
    (v) => v.lang && v.lang.toLowerCase().startsWith("ru"),
  );
  if (startsWithRu) return startsWithRu;
  return voices[0] ?? null;
}

function ensureVoiceLoaded(): void {
  if (cachedVoice || voicesLoaded) return;
  cachedVoice = pickRuVoice();
  if (cachedVoice) {
    voicesLoaded = true;
    return;
  }
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    voicesLoaded = true;
    return;
  }
  window.speechSynthesis.addEventListener(
    "voiceschanged",
    () => {
      if (!cachedVoice) {
        cachedVoice = pickRuVoice();
      }
      voicesLoaded = true;
    },
    { once: true },
  );
}

interface ReplicaVoiceOptions {
  identity: string;
  isLocal: boolean;
}

function getPitchForIdentity(identity: string): number {
  const existing = pitchByIdentity.get(identity);
  if (typeof existing === "number") return existing;
  const min = 0;
  const max = 2;
  const pitch = min + Math.random() * (max - min);
  pitchByIdentity.set(identity, pitch);
  return pitch;
}

export function speakReplicaTextWithVoice(
  rawText: string,
  options: ReplicaVoiceOptions,
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }
  const trimmed = rawText.trim();
  if (!trimmed) return;

  ensureVoiceLoaded();

  const text = trimmed.length > 250 ? `${trimmed.slice(0, 247)}…` : trimmed;
  const utterance = new SpeechSynthesisUtterance(text);

  if (cachedVoice) {
    utterance.voice = cachedVoice;
    utterance.lang = cachedVoice.lang || "ru-RU";
  } else {
    utterance.lang = "ru-RU";
  }

  utterance.rate = 1;
  utterance.pitch = getPitchForIdentity(options.identity);
  utterance.volume = options.isLocal ? 0.35 : 0.8;

  window.speechSynthesis.speak(utterance);
}

export function speakReplicaText(rawText: string): void {
  speakReplicaTextWithVoice(rawText, { identity: "unknown", isLocal: false });
}

export function cancelReplicaSpeech(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }
  window.speechSynthesis.cancel();
}
