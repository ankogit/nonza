let cachedVoice: SpeechSynthesisVoice | null = null;
let voicesLoaded = false;

function pickRuVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const exactRu = voices.find((v) => v.lang === "ru-RU");
  if (exactRu) return exactRu;
  const startsWithRu = voices.find((v) =>
    v.lang && v.lang.toLowerCase().startsWith("ru"),
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

export function speakReplicaText(rawText: string): void {
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
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}

export function cancelReplicaSpeech(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }
  window.speechSynthesis.cancel();
}

