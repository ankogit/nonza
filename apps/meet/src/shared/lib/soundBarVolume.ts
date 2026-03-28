import { ref } from "vue";

const STORAGE_KEY = "nonza_sound_bar_volume";
const MUTED_STORAGE_KEY = "nonza_sound_bar_muted";
const DEFAULT_VOLUME = 0.8;

function loadVolume(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_VOLUME;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

function saveVolume(value: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* ignore */
  }
}

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveMuted(value: boolean): void {
  try {
    localStorage.setItem(MUTED_STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export const soundBarVolume = ref(loadVolume());
export const soundBarMuted = ref(loadMuted());

const subscribers = new Set<(v: number) => void>();

export function subscribeSoundBarVolume(cb: (v: number) => void): () => void {
  subscribers.add(cb);
  cb(soundBarMuted.value ? 0 : soundBarVolume.value);
  return () => {
    subscribers.delete(cb);
  };
}

export function setSoundBarVolume(value: number): void {
  const v = Math.max(0, Math.min(1, value));
  soundBarVolume.value = v;
  saveVolume(v);
  if (!soundBarMuted.value) {
    for (const fn of subscribers) {
      try {
        fn(v);
      } catch {
        /* ignore */
      }
    }
  }
}

export function setSoundBarMuted(value: boolean): void {
  soundBarMuted.value = value;
  saveMuted(value);
  const v = value ? 0 : soundBarVolume.value;
  for (const fn of subscribers) {
    try {
      fn(v);
    } catch {
      /* ignore */
    }
  }
}

export function toggleSoundBarMuted(): void {
  setSoundBarMuted(!soundBarMuted.value);
}
