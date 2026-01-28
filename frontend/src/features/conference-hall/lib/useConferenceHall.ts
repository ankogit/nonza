import { ref, computed, onUnmounted, watch } from "vue";
import type {
  LocalParticipant,
  RemoteParticipant,
  Room as LiveKitRoom,
} from "livekit-client";
import { DataPacket_Kind, RoomEvent } from "livekit-client";

export interface ParticipantState {
  identity: string;
  name: string;
  isLeader: boolean;
  hasRaisedHand: boolean;
  hasSpeakingPermission: boolean;
  isLocal: boolean;
}

export interface ConferenceHallState {
  leaderIdentity: string | null;
  participants: Map<string, ParticipantState>;
  raisedHands: string[]; // identities of participants with raised hands
  speakingPermissions: string[]; // identities of participants with speaking permission
}

export function useConferenceHall(
  localParticipant: () => LocalParticipant | null,
  remoteParticipants: () => RemoteParticipant[],
  participantName: () => string,
  livekitRoom: () => LiveKitRoom | null,
  onStateChange?: (state: ConferenceHallState) => void,
) {
  const state = ref<ConferenceHallState>({
    leaderIdentity: null,
    participants: new Map(),
    raisedHands: [],
    speakingPermissions: [],
  });

  // Broadcast current state to all participants via LiveKit DataChannel
  const broadcastState = () => {
    const local = localParticipant();
    const room = livekitRoom();
    if (!local || !room) return;

    // Send only the synchronizable parts of the state
    const stateToSync: Partial<ConferenceHallState> = {
      leaderIdentity: state.value.leaderIdentity,
      raisedHands: [...state.value.raisedHands],
      speakingPermissions: [...state.value.speakingPermissions],
    };

    try {
      const data = JSON.stringify({
        type: "conference_hall_state",
        payload: stateToSync,
      });

      // Use RELIABLE for guaranteed delivery (max 15KB)
      (local.publishData as any)(
        new TextEncoder().encode(data),
        DataPacket_Kind.RELIABLE,
      );
    } catch (error) {
      console.error("Error broadcasting conference hall state:", error);
    }
  };

  // Initialize LiveKit data channel listener
  const initDataChannel = () => {
    const room = livekitRoom();
    if (!room) return;

    // Listen for data messages from other participants
    const handleData = (
      payload: Uint8Array,
      participant?: RemoteParticipant | LocalParticipant,
      _kind?: DataPacket_Kind,
      topic?: string,
    ) => {
      // Only process messages from conference_hall topic
      if (topic && topic !== "conference_hall") {
        return;
      }

      // Don't process our own messages
      const local = localParticipant();
      if (participant && participant.identity === local?.identity) {
        return;
      }

      try {
        const data = JSON.parse(new TextDecoder().decode(payload));

        if (data.type === "conference_hall_state" && data.payload) {
          const receivedState = data.payload as Partial<ConferenceHallState>;

          if (receivedState.leaderIdentity !== undefined) {
            state.value.leaderIdentity = receivedState.leaderIdentity;
          }

          if (Array.isArray(receivedState.raisedHands)) {
            state.value.raisedHands = [...receivedState.raisedHands];
          }

          if (Array.isArray(receivedState.speakingPermissions)) {
            state.value.speakingPermissions = [
              ...receivedState.speakingPermissions,
            ];
          }

          updateParticipants();
        } else if (data.type === "request_state") {
          // Someone requested current state, send it
          broadcastState();
        }
      } catch (error) {
        console.error("Error parsing data message:", error);
      }
    };

    // Subscribe to data messages
    room.on(RoomEvent.DataReceived, handleData);

    // Request current state when connected
    const requestState = () => {
      const local = localParticipant();
      if (!local) return;

      try {
        const request = JSON.stringify({ type: "request_state" });
        (local.publishData as any)(
          new TextEncoder().encode(request),
          DataPacket_Kind.RELIABLE,
        );
      } catch (error) {
        console.error("Error requesting state:", error);
      }
    };

    // Request state after a short delay to ensure room is ready
    if (room.state === "connected") {
      setTimeout(requestState, 500);
    } else {
      room.once("connected", () => {
        setTimeout(requestState, 500);
      });
    }

    // Cleanup function
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  };

  // Initialize data channel when room is available
  let cleanupDataChannel: (() => void) | null | undefined = null;

  watch(
    livekitRoom,
    (room) => {
      if (cleanupDataChannel) {
        cleanupDataChannel();
        cleanupDataChannel = null;
      }

      if (room && room.state === "connected") {
        cleanupDataChannel = initDataChannel();
      } else if (room) {
        room.once("connected", () => {
          cleanupDataChannel = initDataChannel();
        });
      }
    },
    { immediate: true },
  );

  // Cleanup on unmount
  onUnmounted(() => {
    if (cleanupDataChannel) {
      cleanupDataChannel();
      cleanupDataChannel = null;
    }
  });

  // Initialize leader as first participant (local if exists, otherwise first remote)
  const initializeLeader = () => {
    const local = localParticipant();
    const remotes = remoteParticipants();

    if (local) {
      state.value.leaderIdentity = local.identity;
    } else if (remotes.length > 0) {
      state.value.leaderIdentity = remotes[0].identity;
    }
  };

  // Update participants map
  const updateParticipants = () => {
    const local = localParticipant();
    const remotes = remoteParticipants();
    const name = participantName();

    const participants = new Map<string, ParticipantState>();

    // Add local participant
    if (local) {
      participants.set(local.identity, {
        identity: local.identity,
        name: name,
        isLeader: state.value.leaderIdentity === local.identity,
        hasRaisedHand: state.value.raisedHands.includes(local.identity),
        hasSpeakingPermission: state.value.speakingPermissions.includes(
          local.identity,
        ),
        isLocal: true,
      });
    }

    // Add remote participants
    remotes.forEach((participant) => {
      participants.set(participant.identity, {
        identity: participant.identity,
        name: participant.name || participant.identity,
        isLeader: state.value.leaderIdentity === participant.identity,
        hasRaisedHand: state.value.raisedHands.includes(participant.identity),
        hasSpeakingPermission: state.value.speakingPermissions.includes(
          participant.identity,
        ),
        isLocal: false,
      });
    });

    state.value.participants = participants;
    onStateChange?.(state.value);
  };

  // Check if current user is leader
  const isLeader = computed(() => {
    const local = localParticipant();
    if (!local) return false;
    return state.value.leaderIdentity === local.identity;
  });

  // Get leader participant
  const leader = computed(() => {
    if (!state.value.leaderIdentity) return null;
    return state.value.participants.get(state.value.leaderIdentity) || null;
  });

  // Get participants with raised hands
  const participantsWithRaisedHands = computed(() => {
    return Array.from(state.value.participants.values())
      .filter((p) => p.hasRaisedHand && !p.isLeader)
      .sort((a, b) => {
        // Sort by order they raised hand
        const aIndex = state.value.raisedHands.indexOf(a.identity);
        const bIndex = state.value.raisedHands.indexOf(b.identity);
        return aIndex - bIndex;
      });
  });

  // Actions
  const raiseHand = () => {
    const local = localParticipant();
    if (!local || isLeader.value) return;
    if (!state.value.raisedHands.includes(local.identity)) {
      state.value.raisedHands.push(local.identity);
      updateParticipants();
      // Broadcast full state to sync with other participants
      broadcastState();
    }
  };

  const lowerHand = () => {
    const local = localParticipant();
    if (!local) return;
    const index = state.value.raisedHands.indexOf(local.identity);
    if (index > -1) {
      state.value.raisedHands.splice(index, 1);
      updateParticipants();
      // Broadcast full state to sync with other participants
      broadcastState();
    }
  };

  const grantSpeakingPermission = (participantIdentity: string) => {
    if (!isLeader.value) return;
    if (!state.value.speakingPermissions.includes(participantIdentity)) {
      state.value.speakingPermissions.push(participantIdentity);
      // Remove from raised hands if present
      const raisedIndex = state.value.raisedHands.indexOf(participantIdentity);
      if (raisedIndex > -1) {
        state.value.raisedHands.splice(raisedIndex, 1);
      }
      updateParticipants();
      // Broadcast full state to sync with other participants
      broadcastState();
    }
  };

  const revokeSpeakingPermission = (participantIdentity: string) => {
    if (!isLeader.value) return;
    const index = state.value.speakingPermissions.indexOf(participantIdentity);
    if (index > -1) {
      state.value.speakingPermissions.splice(index, 1);
      updateParticipants();
      // Broadcast full state to sync with other participants
      broadcastState();
    }
  };

  const transferLeadership = (participantIdentity: string) => {
    if (!isLeader.value) return;
    state.value.leaderIdentity = participantIdentity;
    // Remove from raised hands and speaking permissions
    const raisedIndex = state.value.raisedHands.indexOf(participantIdentity);
    if (raisedIndex > -1) {
      state.value.raisedHands.splice(raisedIndex, 1);
    }
    const speakingIndex =
      state.value.speakingPermissions.indexOf(participantIdentity);
    if (speakingIndex > -1) {
      state.value.speakingPermissions.splice(speakingIndex, 1);
    }
    updateParticipants();
    // Broadcast full state to sync with other participants
    broadcastState();
  };

  // Update when participants change
  const watchParticipants = () => {
    updateParticipants();
    // If leader left, assign new leader
    const local = localParticipant();
    const remotes = remoteParticipants();

    if (state.value.leaderIdentity) {
      const leaderExists =
        local?.identity === state.value.leaderIdentity ||
        remotes.some((p) => p.identity === state.value.leaderIdentity);
      if (!leaderExists) {
        initializeLeader();
      }
    } else {
      initializeLeader();
    }
  };

  return {
    state: computed(() => state.value),
    isLeader,
    leader,
    participantsWithRaisedHands,
    raiseHand,
    lowerHand,
    grantSpeakingPermission,
    revokeSpeakingPermission,
    transferLeadership,
    updateParticipants: watchParticipants,
  };
}
