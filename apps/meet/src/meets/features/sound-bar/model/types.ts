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

export type SoundBarActionStartPayload = {
  action: "start";
  sessionId: string;
  senderIdentity: string;
  emoji: string;
  audioUrl: string;
  loopEnabled: boolean;
  gateEnabled: boolean;
  sessionVolume: number;
  playbackSpeed: number;
  playbackPitch: number;
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

