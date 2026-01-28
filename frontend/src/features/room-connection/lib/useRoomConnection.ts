import { ref, computed, onUnmounted, type ComputedRef } from "vue";
import { Room, RoomApi } from "@entities/room";
import {
  Room as LiveKitRoom,
  RoomEvent,
  RemoteParticipant,
  LocalParticipant,
  ParticipantEvent,
} from "livekit-client";
import { normalizeLiveKitUrl, isValidToken } from "@shared/lib";
import type { RoomTokenResponse } from "@entities/room";

export interface RoomConnectionState {
  room: Room | null;
  livekitRoom: LiveKitRoom | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  participants: Map<string, RemoteParticipant | LocalParticipant>;
  participantsVersion: number; // Version counter to force reactivity
  /** Reactive display names (identity -> name) so Vue updates when remote name changes */
  participantNames: Record<string, string>;
}

export interface UseRoomConnectionReturn {
  state: ComputedRef<RoomConnectionState>;
  localParticipant: ComputedRef<LocalParticipant | null>;
  remoteParticipants: ComputedRef<RemoteParticipant[]>;
  getDisplayName: (participant: RemoteParticipant | LocalParticipant) => string;
  connect: (shortCode: string, participantName: string, livekitUrl: string) => Promise<void>;
  disconnect: () => void;
}

export function useRoomConnection(roomApi: RoomApi): UseRoomConnectionReturn {
  const state = ref<RoomConnectionState>({
    room: null,
    livekitRoom: null,
    isConnecting: false,
    isConnected: false,
    error: null,
    participants: new Map(),
    participantsVersion: 0,
    participantNames: {},
  });

  // Helper to update participants and increment version
  const updateParticipants = (
    updater: (map: Map<string, RemoteParticipant | LocalParticipant>) => void,
  ) => {
    const newParticipants = new Map(state.value.participants) as any as Map<string, RemoteParticipant | LocalParticipant>;
    updater(newParticipants);
    state.value.participants = newParticipants as any;
    state.value.participantsVersion++;
    console.log(
      "Participants updated, version:",
      state.value.participantsVersion,
      "count:",
      newParticipants.size,
    );
  };

  const localParticipant = computed(() => {
    return state.value.livekitRoom?.localParticipant || null;
  });

  const remoteParticipants = computed(() => {
    const version = state.value.participantsVersion;
    const participants = state.value.participants;
    const local = state.value.livekitRoom?.localParticipant;
    const result = Array.from(participants.values()).filter(
      (p) => p !== local,
    ) as RemoteParticipant[];
    void version;
    return result;
  });

  /** Display name for UI: uses reactive participantNames so other clients see name updates */
  const getDisplayName = (participant: RemoteParticipant | LocalParticipant): string => {
    const fromMap = state.value.participantNames[participant.identity];
    if (fromMap !== undefined && fromMap !== "") return fromMap;
    return participant.name ?? participant.identity;
  };

  const connect = async (
    shortCode: string,
    participantName: string,
    livekitUrl: string,
  ): Promise<void> => {
    if (state.value.isConnecting || state.value.isConnected) {
      throw new Error("Already connecting or connected");
    }

    state.value.isConnecting = true;
    state.value.error = null;

    try {
      // Get room info
      const room = await roomApi.getByShortCode(shortCode);
      state.value.room = room;

      // Get token
      const tokenResponse: RoomTokenResponse = await roomApi.getToken(
        shortCode,
        {
          participant_name: participantName,
        },
      );

      // Validate token
      if (!isValidToken(tokenResponse.token)) {
        throw new Error("Invalid token received from server");
      }

      // Normalize LiveKit URL
      const connectUrl = normalizeLiveKitUrl(tokenResponse.url || livekitUrl);

      const livekitRoom = new LiveKitRoom({
        // Configure room options
        adaptiveStream: true,
        dynacast: true,
      });

      // Connect with proper error handling
      try {
        await livekitRoom.connect(connectUrl, tokenResponse.token);
      } catch (connectError) {
        console.error("LiveKit connection error:", connectError);
        const errorMessage =
          connectError instanceof Error
            ? connectError.message
            : "Unknown error";
        throw new Error(
          `Failed to connect to LiveKit: ${errorMessage}. ` +
            `Please check: 1) LiveKit server is running at ${connectUrl}, ` +
            `2) Token is valid, 3) Network connectivity`,
        );
      }

      state.value.livekitRoom = livekitRoom;
      state.value.isConnected = true;

      // Setup event listeners
      setupEventListeners(livekitRoom);

      if (livekitRoom.localParticipant) {
        const local = livekitRoom.localParticipant;
        if (local.name) state.value.participantNames[local.identity] = local.name;
        updateParticipants((map) => {
          map.set(local.identity, local);
        });
      }
    } catch (error) {
      state.value.error =
        error instanceof Error ? error.message : "Failed to connect";
      throw error;
    } finally {
      state.value.isConnecting = false;
    }
  };

  const disconnect = async (): Promise<void> => {
    if (state.value.livekitRoom) {
      await state.value.livekitRoom.disconnect();
      state.value.livekitRoom = null;
      state.value.isConnected = false;
      state.value.participants.clear();
      state.value.participantNames = {};
    }
    state.value.room = null;
  };

  const setupEventListeners = (room: LiveKitRoom) => {
    // Subscribe to tracks of already connected participants
    const initialParticipants = new Map<
      string,
      RemoteParticipant | LocalParticipant
    >();
    room.remoteParticipants.forEach((participant) => {
      initialParticipants.set(participant.identity, participant);
      participant.trackPublications.forEach((publication) => {
        if (publication.trackSid && !publication.isSubscribed) {
          publication.setSubscribed(true);
        }
      });
    });
    // Add local participant if exists
    if (room.localParticipant) {
      initialParticipants.set(
        room.localParticipant.identity,
        room.localParticipant,
      );
    }
    state.value.participants = initialParticipants;
    state.value.participantsVersion++;
    initialParticipants.forEach((p) => {
      if (p.name) state.value.participantNames[p.identity] = p.name;
    });

    // Helper function to setup participant event listeners
    const setupParticipantListeners = (participant: RemoteParticipant | LocalParticipant) => {
      participant.on(ParticipantEvent.TrackMuted, (publication) => {
        console.log(
          "Track muted event for participant:",
          participant.identity,
          "track:",
          publication.kind,
        );
        updateParticipants((map) => {
          map.set(participant.identity, participant);
        });
      });

      participant.on(ParticipantEvent.TrackUnmuted, (publication) => {
        console.log(
          "Track unmuted event for participant:",
          participant.identity,
          "track:",
          publication.kind,
        );
        updateParticipants((map) => {
          map.set(participant.identity, participant);
        });
      });

      participant.on(ParticipantEvent.ParticipantMetadataChanged, () => {
        if (participant.name !== undefined)
          state.value.participantNames[participant.identity] = participant.name;
        updateParticipants((map) => {
          map.set(participant.identity, participant);
        });
      });

      participant.on(ParticipantEvent.ParticipantNameChanged, (name: string) => {
        state.value.participantNames[participant.identity] = name;
        updateParticipants((map) => {
          map.set(participant.identity, participant);
        });
      });
    };

    // Setup listeners for already connected participants
    room.remoteParticipants.forEach((participant) => {
      setupParticipantListeners(participant);
    });

    // Setup listeners for local participant
    if (room.localParticipant) {
      setupParticipantListeners(room.localParticipant);
    }

    const setParticipantDisplayName = (participant: RemoteParticipant | LocalParticipant, name: string) => {
      state.value.participantNames[participant.identity] = name;
    };

    const handleRoomMetadataChanged = (_metadata: string | undefined, participant: RemoteParticipant | LocalParticipant) => {
      const newName = participant.name ?? "";
      setParticipantDisplayName(participant, newName);
      updateParticipants((map) => {
        map.delete(participant.identity);
        map.set(participant.identity, participant);
      });
    };

    const handleRoomNameChanged = (name: string, participant: RemoteParticipant | LocalParticipant) => {
      setParticipantDisplayName(participant, name);
      updateParticipants((map) => {
        map.set(participant.identity, participant);
      });
    };

    room.on(RoomEvent.ParticipantMetadataChanged, handleRoomMetadataChanged);
    room.on(RoomEvent.ParticipantNameChanged, handleRoomNameChanged);

    room.on(
      RoomEvent.ParticipantConnected,
      (participant: RemoteParticipant) => {
        if (participant.name) state.value.participantNames[participant.identity] = participant.name;
        updateParticipants((map) => {
          map.set(participant.identity, participant);
        });

        setupParticipantListeners(participant);

        // Subscribe to all existing tracks when participant connects
        participant.trackPublications.forEach((publication) => {
          if (publication.trackSid && !publication.isSubscribed) {
            publication.setSubscribed(true);
          }
        });
      },
    );

    room.on(
      RoomEvent.ParticipantDisconnected,
      (participant: RemoteParticipant) => {
        delete state.value.participantNames[participant.identity];
        updateParticipants((map) => {
          map.delete(participant.identity);
        });
      },
    );

    // Handle track published events - subscribe to new tracks
    room.on(RoomEvent.TrackPublished, (publication, participant) => {
      if (participant instanceof RemoteParticipant && publication.trackSid) {
        // Automatically subscribe to remote tracks when they're published
        if (!publication.isSubscribed) {
          publication.setSubscribed(true);
        }
      }
      // Update state to reflect new track
      if (participant) {
        updateParticipants((map) => {
          map.set(participant.identity, participant);
        });
      }
    });

    // Handle track subscriptions - track is now available
    room.on(RoomEvent.TrackSubscribed, (_track, _publication, participant) => {
      if (participant) {
        updateParticipants((map) => {
          map.set(participant.identity, participant);
        });
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (_track, _publication, participant) => {
      if (participant) {
        updateParticipants((map) => {
          map.set(participant.identity, participant);
        });
      }
    });
  };

  onUnmounted(() => {
    disconnect();
  });

  return {
    state: computed(() => state.value),
    localParticipant,
    remoteParticipants,
    getDisplayName,
    connect,
    disconnect,
  } as UseRoomConnectionReturn;
}
