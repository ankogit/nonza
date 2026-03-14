import { ref, computed, onUnmounted, watch, nextTick } from "vue";
import type {
  LocalParticipant,
  RemoteParticipant,
  Room as LiveKitRoom,
} from "livekit-client";
import { RoomEvent } from "livekit-client";

const DATA_TOPIC = "conference_hall";

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
  options?: {
    initialLeaderIdentity?: () => string | null;
    onLeaderChange?: (leaderIdentity: string | null) => void;
  },
) {
  const state = ref<ConferenceHallState>({
    leaderIdentity: null,
    participants: new Map(),
    raisedHands: [],
    speakingPermissions: [],
  });

  const stateSynced = ref(false);

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

  local
    .publishData(new TextEncoder().encode(data), {
      reliable: true,
      topic: DATA_TOPIC,
    })
    .catch((err) =>
      console.error("Error broadcasting conference hall state:", err),
    );
    console.log("[conference-hall] broadcastState", {
      raisedHands: stateToSync.raisedHands,
    });
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
      _kind?: unknown,
      topic?: string,
    ) => {
      // Only skip if topic is set and not ours (allow undefined for backward compat)
      if (topic != null && topic !== DATA_TOPIC) {
        console.log("[conference-hall] skip: wrong topic", { topic, expected: DATA_TOPIC });
        return;
      }

      // Don't process our own messages
      const local = localParticipant();
      if (participant && participant.identity === local?.identity) {
        console.log("[conference-hall] skip: own message", { identity: local?.identity });
        return;
      }

      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        console.log("[conference-hall] DataReceived", {
          from: participant?.identity,
          topic,
          type: data?.type,
        });
        if (data.type === "conference_hall_state" && data.payload) {
          const receivedState = data.payload as Partial<ConferenceHallState>;

          // Defer state updates to next tick so we don't trigger Vue re-renders
          // synchronously inside the LiveKit callback (avoids patch/emitsOptions errors).
          nextTick(() => {
            if (receivedState.leaderIdentity !== undefined) {
              state.value.leaderIdentity = receivedState.leaderIdentity;
            }
            const local = localParticipant();
            if (
              local &&
              receivedState.leaderIdentity !== undefined &&
              receivedState.leaderIdentity === local.identity
            ) {
              options?.onLeaderChange?.(state.value.leaderIdentity);
            }

            if (Array.isArray(receivedState.raisedHands)) {
              const nextRaised = [...receivedState.raisedHands];
              const local = localParticipant();
              const grantedSpeakingInThisUpdate =
                local &&
                Array.isArray(receivedState.speakingPermissions) &&
                receivedState.speakingPermissions.includes(local.identity);
              if (
                local &&
                state.value.raisedHands.includes(local.identity) &&
                !nextRaised.includes(local.identity) &&
                !grantedSpeakingInThisUpdate
              ) {
                nextRaised.push(local.identity);
              }
              console.log("[conference-hall] received raisedHands", {
                from: participant?.identity,
                nextRaised,
                prevRaised: state.value.raisedHands,
              });
              state.value.raisedHands = nextRaised;
            }

            if (Array.isArray(receivedState.speakingPermissions)) {
              state.value.speakingPermissions = [
                ...receivedState.speakingPermissions,
              ];
            }

            stateSynced.value = true;
            updateParticipants();
          });
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
        local
          .publishData(new TextEncoder().encode(request), {
            reliable: true,
            topic: DATA_TOPIC,
          })
          .catch(() => {});
      } catch (error) {
        console.error("Error requesting state:", error);
      }
    };

    // Request state after a short delay to ensure room is ready
    if (room.state === "connected") {
      setTimeout(requestState, 500);
      setTimeout(() => {
        stateSynced.value = true;
      }, 1200);
    } else {
      room.once("connected", () => {
        setTimeout(requestState, 500);
        setTimeout(() => {
          stateSynced.value = true;
        }, 1200);
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
      stateSynced.value = false;
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
    state.value = { ...state.value };
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
    options?.onLeaderChange?.(state.value.leaderIdentity);
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
    const local = localParticipant();
    const remotes = remoteParticipants();
    const presentIdentities = new Set<string>();
    if (local) presentIdentities.add(local.identity);
    remotes.forEach((p) => presentIdentities.add(p.identity));

    if (
      !state.value.leaderIdentity &&
      options?.initialLeaderIdentity?.()
    ) {
      state.value.leaderIdentity = options.initialLeaderIdentity()!;
      options?.onLeaderChange?.(state.value.leaderIdentity);
    }

    state.value.raisedHands = state.value.raisedHands.filter((id) =>
      presentIdentities.has(id),
    );
    state.value.speakingPermissions =
      state.value.speakingPermissions.filter((id) =>
        presentIdentities.has(id),
      );

    updateParticipants();

    if (!state.value.leaderIdentity) {
      const fromRoom = options?.initialLeaderIdentity?.();
      if (fromRoom) {
        state.value.leaderIdentity = fromRoom;
        options?.onLeaderChange?.(state.value.leaderIdentity);
      } else {
        initializeLeader();
        options?.onLeaderChange?.(state.value.leaderIdentity);
      }
    } else {
      const leaderExists = presentIdentities.has(state.value.leaderIdentity);
      if (!leaderExists) {
        // Лидер вышел — не назначаем нового, ждём его возвращения
      }
    }
  };

  return {
    state: computed(() => state.value),
    stateSynced: computed(() => stateSynced.value),
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
