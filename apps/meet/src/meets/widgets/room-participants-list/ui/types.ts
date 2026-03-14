import type { RemoteParticipant, LocalParticipant } from "livekit-client";

export interface RoomParticipantListItem {
  identity: string;
  participantName: string;
  participantColor?: string;
  participant?: LocalParticipant | RemoteParticipant | null;
  isSpeaking?: boolean;
  isLeader?: boolean;
  hasRaisedHand?: boolean;
  hasSpeakingPermission?: boolean;
  isAudioEnabled?: boolean;
  replicaText?: string;
}
