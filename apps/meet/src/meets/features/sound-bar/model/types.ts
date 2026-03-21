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

export type SoundBarActionMessage = {
  type: "sound_bar_action";
  payload: {
    action: "start" | "stop";
    sessionId: string;
    senderIdentity: string;
    emoji: string;
    audioUrl: string;
    loopEnabled: boolean;
    gateEnabled: boolean;
    ts: number;
  };
};

