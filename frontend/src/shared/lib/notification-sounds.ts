import { ref, computed, type Ref, type ComputedRef } from "vue";
import { getStoredAudioOutputDevice } from "./audio-devices";

export const NOTIFICATION_SOUND_EVENTS = [
  "participant_joined",
  "participant_left",
  "message",
  "mic_on",
  "mic_off",
] as const;

export type NotificationSoundEventId =
  (typeof NOTIFICATION_SOUND_EVENTS)[number];

const DEFAULT_URLS: Record<NotificationSoundEventId, string> = {
  participant_joined: "/sounds/join.wav",
  participant_left: "/sounds/left.wav",
  message: "/sounds/message.wav",
  mic_on: "/sounds/mic%20on.wav",
  mic_off: "/sounds/mic%20off.wav",
};

const PAN_BY_EVENT: Partial<Record<NotificationSoundEventId, number>> = {
  participant_joined: -1,
  participant_left: 1,
};
const PAN_OFFSET_RIGHT = 0.2;

const DEFAULT_VOLUME = 0.25;
const VOLUME_SCALE = 0.6;
const DETUNE_CENTS_RANGE = 80;

export interface EventSoundConfig {
  enabled: boolean;
  volume: number;
  url: string;
}

const STORAGE_KEY = "nonza_notification_sounds";

function loadStored(): Partial<
  Record<NotificationSoundEventId, { enabled: boolean; volume: number }>
> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<
      string,
      { enabled?: boolean; volume?: number }
    >;
    const result: Partial<
      Record<NotificationSoundEventId, { enabled: boolean; volume: number }>
    > = {};
    for (const id of NOTIFICATION_SOUND_EVENTS) {
      const s = parsed[id];
      if (s && typeof s.enabled === "boolean" && typeof s.volume === "number") {
        result[id] = {
          enabled: s.enabled,
          volume: Math.max(0, Math.min(1, s.volume)),
        };
      }
    }
    return result;
  } catch {
    return {};
  }
}

function saveStored(
  data: Partial<
    Record<NotificationSoundEventId, { enabled: boolean; volume: number }>
  >
): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

const stored = ref(loadStored());

function getEventConfig(id: NotificationSoundEventId): EventSoundConfig {
  const s = stored.value[id];
  return {
    enabled: s?.enabled ?? true,
    volume: s?.volume ?? DEFAULT_VOLUME,
    url: DEFAULT_URLS[id],
  };
}

async function playWithWebAudio(
  url: string,
  volume: number,
  event: NotificationSoundEventId
): Promise<void> {
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
  const response = await fetch(url);
  if (!response.ok) return;
  const arrayBuffer = await response.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.detune.value = (Math.random() - 0.5) * 2 * DETUNE_CENTS_RANGE;
  const gainNode = ctx.createGain();
  gainNode.gain.value = volume * VOLUME_SCALE;
  const panNode = ctx.createStereoPanner();
  const basePan = PAN_BY_EVENT[event] ?? 0;
  panNode.pan.value = Math.max(-1, Math.min(1, basePan + PAN_OFFSET_RIGHT));
  source.connect(gainNode);
  gainNode.connect(panNode);
  panNode.connect(ctx.destination);
  source.start(0);
  source.onended = () => {
    ctx.close();
  };
}

export function useNotificationSounds(): {
  eventsConfig: ComputedRef<Record<NotificationSoundEventId, EventSoundConfig>>;
  setEventEnabled: (event: NotificationSoundEventId, enabled: boolean) => void;
  setEventVolume: (event: NotificationSoundEventId, volume: number) => void;
  play: (event: NotificationSoundEventId) => Promise<void>;
  eventIds: readonly NotificationSoundEventId[];
} {
  const eventsConfig = computed(() => {
    const out = {} as Record<NotificationSoundEventId, EventSoundConfig>;
    for (const id of NOTIFICATION_SOUND_EVENTS) {
      out[id] = getEventConfig(id);
    }
    return out;
  });

  function setEventEnabled(
    event: NotificationSoundEventId,
    enabled: boolean
  ): void {
    const next = { ...stored.value };
    next[event] = {
      ...next[event],
      enabled,
      volume: next[event]?.volume ?? DEFAULT_VOLUME,
    };
    stored.value = next;
    saveStored(next);
  }

  function setEventVolume(
    event: NotificationSoundEventId,
    volume: number
  ): void {
    const v = Math.max(0, Math.min(1, volume));
    const next = { ...stored.value };
    next[event] = {
      ...next[event],
      enabled: next[event]?.enabled ?? true,
      volume: v,
    };
    stored.value = next;
    saveStored(next);
  }

  async function play(event: NotificationSoundEventId): Promise<void> {
    const config = getEventConfig(event);
    if (!config.enabled) return;
    try {
      await playWithWebAudio(config.url, config.volume, event);
    } catch {
      /* ignore */
    }
  }

  return {
    eventsConfig,
    setEventEnabled,
    setEventVolume,
    play,
    eventIds: NOTIFICATION_SOUND_EVENTS,
  };
}

const sharedInstance: Ref<ReturnType<typeof useNotificationSounds> | null> =
  ref(null);

export function getNotificationSounds(): ReturnType<
  typeof useNotificationSounds
> {
  if (!sharedInstance.value) {
    sharedInstance.value = useNotificationSounds();
  }
  return sharedInstance.value;
}

export function playNotificationSound(
  event: NotificationSoundEventId
): Promise<void> {
  return getNotificationSounds().play(event);
}
