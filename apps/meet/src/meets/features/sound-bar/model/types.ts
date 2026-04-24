export interface OrganizationSound {
  id: string;
  emoji: string;
  title: string;
  audioUrl: string;
  version: number;
  loopEnabled: boolean;
  gateEnabled: boolean;
  volume: number;
  speed: number;
}

export type SoundBarFxSettings = {
  filterHz: number;
  distortion: number;
  delayWet: number;
  delayTimeMs: number;
  reverbWet: number;
  reverbDecayMs: number;
  eqLowDb: number;
  eqMidDb: number;
  eqHighDb: number;
};

export type SoundBarActionStartPayload = {
  action: "start";
  sessionId: string;
  senderIdentity: string;
  emoji: string;
  audioUrl: string;
  /** Версия файла на бэкенде; влияет на ключ decode-кэша у получателей. */
  audioVersion: number;
  loopEnabled: boolean;
  gateEnabled: boolean;
  sessionVolume: number;
  playbackSpeed: number;
  playbackPitch: number;
  fx: SoundBarFxSettings;
  reverse: boolean;
  pendulum: boolean;
  ts: number;
};

export type SoundBarActionStopPayload = {
  action: "stop";
  sessionId: string;
  senderIdentity: string;
  emoji: string;
  audioUrl: string;
  loopEnabled: boolean;
  gateEnabled: boolean;
  ts: number;
};

export type SoundBarActionMessage = {
  type: "sound_bar_action";
  payload: SoundBarActionStartPayload | SoundBarActionStopPayload;
};

