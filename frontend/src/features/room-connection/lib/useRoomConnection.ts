import { ref, computed, onUnmounted, nextTick, type ComputedRef } from "vue";
import { Room, RoomApi } from "@entities/room";
import {
  Room as LiveKitRoom,
  RoomEvent,
  ConnectionState,
  RemoteParticipant,
  LocalParticipant,
  ParticipantEvent,
  ExternalE2EEKeyProvider,
  type RoomOptions,
} from "livekit-client";
import e2eeWorkerUrl from "livekit-client/e2ee-worker?url";
import { normalizeLiveKitUrl, isValidToken, playNotificationSound } from "@shared/lib";
import type { RoomTokenResponse } from "@entities/room";

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Убирает MaxListenersExceededWarning у PCTransport (livekit-client не вызывает setMaxListeners). */
function setLiveKitTransportMaxListeners(room: LiveKitRoom): void {
  const engine = (
    room as {
      engine?: {
        pcManager?: {
          publisher: { setMaxListeners: (n: number) => void };
          subscriber?: { setMaxListeners: (n: number) => void };
        };
      };
    }
  ).engine;
  const pm = engine?.pcManager;
  if (!pm) return;
  pm.publisher.setMaxListeners(100);
  pm.subscriber?.setMaxListeners(100);
}

export interface RoomConnectionState {
  room: Room | null;
  livekitRoom: LiveKitRoom | null;
  isConnecting: boolean;
  isConnected: boolean;
  isReconnecting: boolean;
  error: string | null;
  participants: Map<string, RemoteParticipant | LocalParticipant>;
  participantsVersion: number; // Version counter to force reactivity
  participantNames: Record<string, string>;
}

export interface UseRoomConnectionReturn {
  state: ComputedRef<RoomConnectionState>;
  localParticipant: ComputedRef<LocalParticipant | null>;
  remoteParticipants: ComputedRef<RemoteParticipant[]>;
  getDisplayName: (participant: RemoteParticipant | LocalParticipant) => string;
  connect: (
    shortCode: string,
    participantName: string,
    livekitUrl: string,
  ) => Promise<void>;
  reconnect: () => Promise<void>;
  disconnect: () => void;
}

export function useRoomConnection(roomApi: RoomApi): UseRoomConnectionReturn {
  const state = ref<RoomConnectionState>({
    room: null,
    livekitRoom: null,
    isConnecting: false,
    isConnected: false,
    isReconnecting: false,
    error: null,
    participants: new Map(),
    participantsVersion: 0,
    participantNames: {},
  });

  const lastShortCode = ref<string>("");
  const lastParticipantName = ref<string>("");
  const lastLivekitUrl = ref<string>("");

  const updateParticipants = (
    updater: (map: Map<string, RemoteParticipant | LocalParticipant>) => void,
  ) => {
    const next = new Map(state.value.participants) as Map<
      string,
      RemoteParticipant | LocalParticipant
    >;
    updater(next);
    state.value.participants = next;
    state.value.participantsVersion++;
  };

  const localParticipant = computed(() => {
    return state.value.livekitRoom?.localParticipant || null;
  }) as ComputedRef<LocalParticipant | null>;

  const remoteParticipants = computed(() => {
    const version = state.value.participantsVersion;
    const participants = state.value.participants;
    const local = state.value.livekitRoom?.localParticipant;
    const result = Array.from(participants.values()).filter(
      (p) => p !== local,
    ) as RemoteParticipant[];
    void version;
    return result;
  }) as ComputedRef<RemoteParticipant[]>;

  /** Display name for UI: uses reactive participantNames so other clients see name updates */
  const getDisplayName = (
    participant: RemoteParticipant | LocalParticipant,
  ): string => {
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

      const useE2EE = Boolean(tokenResponse.encryption_key?.trim());
      const roomOptions: RoomOptions = {
        adaptiveStream: true,
        dynacast: true,
      };
      let keyProvider: InstanceType<typeof ExternalE2EEKeyProvider> | null =
        null;

      if (useE2EE) {
        keyProvider = new ExternalE2EEKeyProvider();
        const worker = new Worker(e2eeWorkerUrl, { type: "module" });
        roomOptions.encryption = { keyProvider, worker };
      }

      const livekitRoom = new LiveKitRoom(roomOptions);

      if (keyProvider && tokenResponse.encryption_key) {
        const keyBuffer = base64ToArrayBuffer(tokenResponse.encryption_key);
        await keyProvider.setKey(keyBuffer);
        await livekitRoom.setE2EEEnabled(true);
      }

      try {
        await livekitRoom.connect(connectUrl, tokenResponse.token, {
          rtcConfig: { iceTransportPolicy: "relay" },
        });
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
      state.value.isReconnecting = false;
      lastShortCode.value = shortCode;
      lastParticipantName.value = participantName;
      lastLivekitUrl.value = livekitUrl;

      setupEventListeners(livekitRoom);
      setLiveKitTransportMaxListeners(livekitRoom);

      if (livekitRoom.localParticipant) {
        const local = livekitRoom.localParticipant;
        if (local.name)
          state.value.participantNames[local.identity] = local.name;
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
      state.value.isReconnecting = false;
      state.value.participants.clear();
      state.value.participantNames = {};
    }
    state.value.room = null;
    lastShortCode.value = "";
    lastParticipantName.value = "";
    lastLivekitUrl.value = "";
  };

  const reconnect = async (): Promise<void> => {
    const code = lastShortCode.value?.trim();
    const name = lastParticipantName.value?.trim();
    const url = lastLivekitUrl.value;
    if (!code || !name || !url) {
      state.value.isReconnecting = false;
      state.value.error = "Нет данных для переподключения";
      return;
    }
    state.value.error = null;
    try {
      await connect(code, name, url);
    } catch (err) {
      state.value.error =
        err instanceof Error ? err.message : "Не удалось переподключиться";
    }
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

    const setupParticipantListeners = (
      participant: RemoteParticipant | LocalParticipant,
    ) => {
      participant.on(ParticipantEvent.ParticipantMetadataChanged, () => {
        nextTick(() => {
          if (participant.name !== undefined)
            state.value.participantNames[participant.identity] =
              participant.name;
          updateParticipants((map) => {
            map.set(participant.identity, participant);
          });
        });
      });

      participant.on(
        ParticipantEvent.ParticipantNameChanged,
        (name: string) => {
          nextTick(() => {
            state.value.participantNames[participant.identity] = name;
            updateParticipants((map) => {
              map.set(participant.identity, participant);
            });
          });
        },
      );
    };

    // Setup listeners for already connected participants
    room.remoteParticipants.forEach((participant) => {
      setupParticipantListeners(participant);
    });

    // Setup listeners for local participant
    if (room.localParticipant) {
      setupParticipantListeners(room.localParticipant);
    }

    const setParticipantDisplayName = (
      participant: RemoteParticipant | LocalParticipant,
      name: string,
    ) => {
      state.value.participantNames[participant.identity] = name;
    };

    const handleRoomMetadataChanged = (
      _metadata: string | undefined,
      participant: RemoteParticipant | LocalParticipant,
    ) => {
      const newName = participant.name ?? "";
      setParticipantDisplayName(participant, newName);
      updateParticipants((map) => {
        map.delete(participant.identity);
        map.set(participant.identity, participant);
      });
    };

    const handleRoomNameChanged = (
      name: string,
      participant: RemoteParticipant | LocalParticipant,
    ) => {
      nextTick(() => {
        setParticipantDisplayName(participant, name);
        updateParticipants((map) => {
          map.set(participant.identity, participant);
        });
      });
    };

    room.on(RoomEvent.ParticipantMetadataChanged, handleRoomMetadataChanged);
    room.on(RoomEvent.ParticipantNameChanged, handleRoomNameChanged);

    room.on(RoomEvent.ConnectionStateChanged, (s: ConnectionState) => {
      if (
        s === ConnectionState.Reconnecting ||
        s === ConnectionState.SignalReconnecting
      ) {
        state.value.isReconnecting = true;
      } else if (s === ConnectionState.Connected) {
        state.value.isReconnecting = false;
      } else if (s === ConnectionState.Disconnected) {
        state.value.isConnected = false;
        state.value.livekitRoom = null;
        state.value.isReconnecting = true;
        state.value.participants.clear();
        state.value.participantNames = {};
        state.value.participantsVersion++;
      }
    });

    room.on(
      RoomEvent.ParticipantConnected,
      (participant: RemoteParticipant) => {
        playNotificationSound("participant_joined").catch(() => {});
        setupParticipantListeners(participant);

        // Subscribe to all existing tracks when participant connects
        participant.trackPublications.forEach((publication) => {
          if (publication.trackSid && !publication.isSubscribed) {
            publication.setSubscribed(true);
          }
        });

        nextTick(() => {
          if (participant.name)
            state.value.participantNames[participant.identity] =
              participant.name;
          updateParticipants((map) => {
            map.set(participant.identity, participant);
          });
        });
      },
    );

    room.on(
      RoomEvent.ParticipantDisconnected,
      (participant: RemoteParticipant) => {
        playNotificationSound("participant_left").catch(() => {});
        nextTick(() => {
          delete state.value.participantNames[participant.identity];
          updateParticipants((map) => {
            map.delete(participant.identity);
          });
        });
      },
    );

    // Batch track publish/unpublish: один updateParticipants на nextTick вместо N при быстрых событиях.
    const pendingBump = new Map<string, RemoteParticipant | LocalParticipant>();
    let bumpScheduled = false;
    const flushBump = () => {
      bumpScheduled = false;
      if (pendingBump.size === 0) return;
      updateParticipants((m) => {
        pendingBump.forEach((p, id) => m.set(id, p));
      });
      pendingBump.clear();
    };
    const bumpParticipant = (
      participant: RemoteParticipant | LocalParticipant,
    ) => {
      pendingBump.set(participant.identity, participant);
      if (!bumpScheduled) {
        bumpScheduled = true;
        nextTick(flushBump);
      }
    };

    room.on(RoomEvent.TrackPublished, (publication, participant) => {
      if (
        participant instanceof RemoteParticipant &&
        publication.trackSid &&
        !publication.isSubscribed
      ) {
        publication.setSubscribed(true);
      }
      bumpParticipant(participant);
    });
    room.on(RoomEvent.TrackUnpublished, (_pub, participant) =>
      bumpParticipant(participant),
    );
    room.on(RoomEvent.LocalTrackPublished, (_pub, participant) =>
      bumpParticipant(participant),
    );
    room.on(RoomEvent.LocalTrackUnpublished, (_pub, participant) =>
      bumpParticipant(participant),
    );
  };

  onUnmounted(() => {
    disconnect();
  });

  const stateComputed = computed(
    () => state.value,
  ) as unknown as ComputedRef<RoomConnectionState>;

  return {
    state: stateComputed,
    localParticipant,
    remoteParticipants,
    getDisplayName,
    connect,
    reconnect,
    disconnect,
  };
}
