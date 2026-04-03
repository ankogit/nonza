<template>
  <div class="table-circle bg-dark">
    <header
      v-if="settingsInUpperMenu"
      class="table-circle__top-menu room-header bg-dark-20"
    >
      <div class="room-info color-white font-bebas">
        <h2 class="room-info-title">{{ room?.name ?? "Игровой круг" }}</h2>
      </div>
      <div class="room-indicators">
        <span
          v-if="conferenceHall.isLeader.value"
          class="table-circle__host-badge color-white-60"
        >
          Ведущий
        </span>
        <Button
          variant="default"
          size="small"
          title="Настройки"
          @click="handleSettings"
        >
          <PixelIcon name="settings" variant="small" />
        </Button>
      </div>
    </header>

    <div class="table-circle__content">
      <div
        class="table-circle__main-row"
        :class="{ 'table-circle__main-row--with-collab': sideCollabVisible }"
      >
      <div class="table-circle__board">
        <div class="table-circle__center bg-dark-20" :style="centerStyle">
          <div class="table-circle__center-body">
            <div
              v-show="centerContent === 'chat'"
              class="table-circle__public-table"
            >
              <TableCirclePublicChat
                :local-participant="localParticipant"
                :remote-participants="remoteParticipants"
                :participant-name="props.participantName"
                :get-display-name="props.getDisplayName"
                :livekit-room="props.livekitRoom"
              />
            </div>

            <div
              v-show="centerContent === 'dice'"
              class="table-circle__public-table"
            >
              <TableCirclePublicTable
                :local-participant="localParticipant"
                :remote-participants="remoteParticipants"
                :participant-name="props.participantName"
                :get-display-name="props.getDisplayName"
                :livekit-room="props.livekitRoom"
              />
            </div>

            <div
              v-show="centerContent === 'stream'"
              class="table-circle__leader-stream"
            >
              <div v-if="leaderParticipant" class="table-circle__center-video">
                <VideoParticipant
                  :participant="leaderParticipant"
                  :participant-name="leaderParticipantName"
                  :participant-color="participantColorFor(leaderParticipant)"
                  :is-speaking="speakingIdentitySet.has(leaderParticipant.identity)"
                  preferred-video-source="screen-share"
                  :show-full-size="true"
                  :replica-text="replicaByParticipant[leaderParticipant.identity]?.text"
                />
              </div>
              <div v-else class="table-circle__center-placeholder color-white-60">
                Ожидание лидера...
              </div>
            </div>
          </div>

          <div
            v-if="isSoundBarPanelOpen"
            class="table-circle__sound-panel"
            aria-label="Звуки организации"
          >
            <SoundBar
              layout="panel"
              :org-id="props.room?.organization_id ?? null"
              :livekit-room="props.livekitRoom"
              :preview-mode="previewMode"
            />
          </div>

          <div class="table-circle__center-mode">
            <Button
              variant="default"
              size="small"
              :class="{ active: centerContent === 'chat' }"
              title="Чат стола"
              @click="centerContent = 'chat'"
            >
              <PixelIcon name="message" variant="small" />
            </Button>
            <Button
              variant="default"
              size="small"
              :class="{ active: centerContent === 'dice' }"
              title="Кости"
              @click="centerContent = 'dice'"
            >
              <PixelIcon name="dice" variant="small" />
            </Button>
            <Button
              variant="default"
              size="small"
              :class="{ active: centerContent === 'stream' }"
              title="Стрим ведущего"
              @click="centerContent = 'stream'"
            >
              <PixelIcon name="screen-on" variant="small" />
            </Button>
          </div>
        </div>

        <div class="table-circle__ring" :style="ringStyle">
        <div
          v-for="(p, index) in tableParticipantsOrdered"
          :key="`${participantsKey}-${p.identity}`"
          class="table-circle__seat-wrap"
          :style="seatPositionStyle(index)"
        >
          <div
            class="table-circle__seat"
            :class="{
              'table-circle__seat--highlight': highlightedIdentity === p.identity,
            }"
          >
            <VideoParticipant
              :participant="p"
              :participant-name="
                isLocal(p)
                  ? props.participantName
                  : (props.getDisplayName?.(p) ?? p.name ?? p.identity)
              "
              :participant-color="participantColorFor(p)"
              :is-speaking="speakingIdentitySet.has(p.identity)"
              :show-full-size="false"
              :replica-text="replicaByParticipant[p.identity]?.text"
              class="table-circle__avatar"
            />
            <span class="table-circle__seat-num" aria-hidden="true">
              {{ index + 1 }}
            </span>
            <span
              v-if="leaderIdentity && leaderIdentity === p.identity"
              class="table-circle__seat-host"
            >
              Ведущий
            </span>
            <div
              v-if="conferenceHall.isLeader.value && !isLocal(p)"
              class="table-circle__seat-actions"
            >
              <Button
                variant="default"
                size="small"
                title="Пересадить влево по кругу"
                @click="moveInOrder(p.identity, 'left')"
              >
                <PixelIcon name="left" variant="small" />
              </Button>
              <Button
                variant="default"
                size="small"
                title="Пересадить вправо по кругу"
                @click="moveInOrder(p.identity, 'right')"
              >
                <PixelIcon name="right" variant="small" />
              </Button>
            </div>
          </div>
        </div>

        <template v-if="previewMode && tableParticipantsOrdered.length === 0">
          <div
            v-for="(name, i) in previewNames"
            :key="`preview-${i}`"
            class="table-circle__seat-wrap"
            :style="seatPositionStylePreview(i)"
          >
            <div class="table-circle__seat">
              <VideoParticipant
                :participant="null"
                :participant-name="name"
                :is-speaking="false"
                :preview-mode="true"
                class="table-circle__avatar"
              />
            </div>
          </div>
        </template>
        </div>
      </div>

      <div
        v-if="sideCollabVisible"
        class="table-circle__collab-column"
        aria-label="Совместная работа"
      >
        <div
          v-if="collaborationEnabled && isDocumentOpen"
          class="table-circle__collab-block table-circle__collab-block--document"
        >
          <CollaborativeDocument
            :room="props.room"
            :participant-name="props.participantName"
            :participant-color="participantColorForDocument"
          />
        </div>
        <div
          v-if="collaborationEnabled && isWhiteboardOpen && !whiteboardFullscreen"
          class="table-circle__collab-block table-circle__collab-block--whiteboard"
        >
          <CollaborativeWhiteboardShell
            :participant-color="participantColorForDocument"
            :room-id="props.room?.id ?? null"
          />
        </div>
      </div>
      </div>
    </div>

    <CallMenu
      display-room-type="table_circle"
      :room-id="props.room?.id ?? null"
      :enabled-widget-ids="enabledTableCircleCallWidgets"
      :active-call-widget-ids="activeCallWidgetIds"
      @disconnect="handleDisconnect"
      @activate-call-widget="activateCallWidgetFromMenu"
    >
      <template #left>
        <Button
          :class="{ active: mediaState.isAudioEnabled, default: !mediaState.isAudioEnabled }"
          :title="mediaState.isAudioEnabled ? 'Выключить микрофон' : 'Включить микрофон'"
          @click="toggleAudio"
        >
          <PixelIcon :name="mediaState.isAudioEnabled ? 'mic-on' : 'mic-off'" variant="large" />
        </Button>
        <Button
          :class="{ active: mediaState.isVideoEnabled, default: !mediaState.isVideoEnabled }"
          :title="mediaState.isVideoEnabled ? 'Выключить видео' : 'Включить видео'"
          @click="toggleVideo"
        >
          <PixelIcon :name="mediaState.isVideoEnabled ? 'video-on' : 'video-off'" variant="large" />
        </Button>
        <Button
          v-if="!previewMode"
          :class="{ active: mediaState.isScreenSharing, default: !mediaState.isScreenSharing }"
          title="Трансляция экрана"
          @click="toggleScreenShare"
        >
          <PixelIcon :name="mediaState.isScreenSharing ? 'screen-on' : 'screen-off'" variant="large" />
        </Button>
        <ReplicaInput v-if="!previewMode" @submit="handleReplicaSubmit" />
      </template>

      <template #right>
        <div class="table-circle__quick-target">
          <Button
            variant="default"
            size="small"
            title="Слева"
            :disabled="!targetLeftIdentity"
            @click="highlight(targetLeftIdentity)"
          >
            <PixelIcon name="left" variant="small" />
          </Button>
          <Button
            variant="default"
            size="small"
            title="Напротив"
            :disabled="!targetOppositeIdentity"
            @click="highlight(targetOppositeIdentity)"
          >
            <PixelIcon name="people" variant="small" />
          </Button>
          <Button
            variant="default"
            size="small"
            title="Справа"
            :disabled="!targetRightIdentity"
            @click="highlight(targetRightIdentity)"
          >
            <PixelIcon name="right" variant="small" />
          </Button>
        </div>
      </template>
      <template #widget-table_chat>
        <Button
          variant="default"
          size="small"
          :class="{ active: centerContent === 'chat' }"
          title="Чат стола"
          @click="centerContent = 'chat'"
        >
          <PixelIcon name="message" variant="small" />
        </Button>
      </template>
      <template #widget-table_dice>
        <Button
          variant="default"
          size="small"
          :class="{ active: centerContent === 'dice' }"
          title="Кости"
          @click="centerContent = 'dice'"
        >
          <PixelIcon name="dice" variant="small" />
        </Button>
      </template>
      <template #widget-table_stream>
        <Button
          variant="default"
          size="small"
          :class="{ active: centerContent === 'stream' }"
          title="Стрим ведущего"
          @click="centerContent = 'stream'"
        >
          <PixelIcon name="screen-on" variant="small" />
        </Button>
      </template>
      <template #widget-document>
        <Button
          variant="default"
          size="small"
          :class="{ active: isDocumentOpen }"
          :title="isDocumentOpen ? 'Скрыть документ' : 'Совместный документ'"
          @click="toggleDocument"
        >
          <PixelIcon name="document" variant="small" />
        </Button>
      </template>
      <template #widget-whiteboard>
        <Button
          variant="default"
          size="small"
          :class="{ active: isWhiteboardOpen }"
          :title="isWhiteboardOpen ? 'Скрыть доску' : 'Совместная доска'"
          @click="toggleWhiteboard"
        >
          <PixelIcon name="edit" variant="small" />
        </Button>
      </template>
      <template #widget-soundbar>
        <Button
          variant="default"
          size="small"
          :class="{ active: isSoundBarPanelOpen }"
          :title="
            isSoundBarPanelOpen
              ? 'Скрыть звуки организации'
              : 'Звуки организации'
          "
          @click="isSoundBarPanelOpen = !isSoundBarPanelOpen"
        >
          <PixelIcon name="notes" variant="small" />
        </Button>
      </template>
      <template #widget-settings>
        <Button
          v-if="settingsInCallMenu"
          variant="default"
          size="small"
          title="Настройки"
          @click="handleSettings"
        >
          <PixelIcon name="settings" variant="large" />
        </Button>
      </template>
    </CallMenu>

    <Modal v-model="settingsOpen" title="Настройки">
      <div class="table-circle__settings">
        <AudioSettings ref="audioSettingsRef" />
      </div>
    </Modal>

    <Teleport to="body">
      <div
        v-if="collaborationEnabled && isWhiteboardOpen && whiteboardFullscreen"
        class="room-fullscreen"
        role="dialog"
        aria-label="Совместная доска"
      >
        <Button
          variant="default"
          size="small"
          class="room-fullscreen__close"
          title="Закрыть доску"
          aria-label="Закрыть доску"
          @click="toggleWhiteboard"
        >
          <PixelIcon name="close" variant="large" />
        </Button>
        <div class="room-fullscreen__editor">
          <CollaborativeWhiteboardShell
            :participant-color="participantColorForDocument"
            :room-id="props.room?.id ?? null"
          />
        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, provide, toRef } from "vue";
import { RoomEvent } from "livekit-client";
import type { Room as LiveKitRoom, RemoteParticipant, LocalParticipant } from "livekit-client";
import type { Room as RoomEntity } from "@shared/entities";
import { useMediaControl } from "@features/media-control";
import {
  useParticipantReplica,
  ReplicaInput,
} from "@features/participant-replica";
import { useConferenceHall } from "@features/conference-hall";
import { useTableCircle } from "@features/table-circle";
import { SoundBar } from "@features/sound-bar";
import {
  MEET_ROOM_COLLABORATION_KEY,
  useMeetRoomYCollaboration,
} from "@features/room-collaboration";
import { CollaborativeDocument } from "@widgets/collaborative-document";
import { CollaborativeWhiteboardShell } from "@widgets/collaborative-whiteboard";
import { Button, Modal, AudioSettings, PixelIcon } from "@shared/ui";
import { VideoParticipant } from "@widgets/video-participant";
import { CallMenu } from "@widgets/call-menu";
import type { CallWidgetId } from "@features/call-widgets";
import TableCirclePublicTable from "./TableCirclePublicTable.vue";
import TableCirclePublicChat from "./TableCirclePublicChat.vue";
import {
  DEFAULT_PARTICIPANT_COLOR,
  parseParticipantColorFromMetadata,
  getAuthState,
  readTableCircleCenterForRoom,
  writeTableCircleCenterForRoom,
} from "@shared/lib";

import type { RoomApi } from "@shared/entities";

const props = defineProps<{
  room: RoomEntity | null;
  livekitRoom: LiveKitRoom | null;
  localParticipant?: LocalParticipant | null;
  remoteParticipants?: RemoteParticipant[];
  getDisplayName?: (p: RemoteParticipant | LocalParticipant) => string;
  participantName: string;
  apiBaseURL: string;
  roomApi?: RoomApi | null;
  showDocument?: boolean;
  previewMode?: boolean;
  settingsInCallMenu?: boolean;
  settingsInUpperMenu?: boolean;
  updateParticipantName?: (name: string) => void;
}>();

const emit = defineEmits<{
  disconnect: [];
  "update:participantName": [name: string];
}>();

const enabledTableCircleCallWidgets = computed<CallWidgetId[]>(() => {
  const ids: CallWidgetId[] = [
    "document",
    "whiteboard",
    "table_chat",
    "table_dice",
    "table_stream",
    "soundbar",
  ];
  if (props.settingsInCallMenu) ids.push("settings");
  return ids;
});

const previewMode = computed(() => props.previewMode ?? false);
const settingsInCallMenu = computed(() => props.settingsInCallMenu ?? false);
const settingsInUpperMenu = computed(() => props.settingsInUpperMenu ?? true);

function participantColorFor(p: LocalParticipant | RemoteParticipant): string {
  const name =
    p.identity === localParticipant.value?.identity
      ? props.participantName
      : (props.getDisplayName?.(p) ?? (p as RemoteParticipant).name ?? p.identity);
  return parseParticipantColorFromMetadata((p as { metadata?: string }).metadata, name);
}

const localParticipant = computed<LocalParticipant | null>(() => {
  return props.localParticipant ?? props.livekitRoom?.localParticipant ?? null;
});

const remoteParticipants = computed<RemoteParticipant[]>(() => {
  if (props.remoteParticipants) return props.remoteParticipants;
  if (!props.livekitRoom) return [];
  return Array.from(props.livekitRoom.remoteParticipants.values());
});

const isSoundBarPanelOpen = ref(false);

const participantColorForDocument = computed(() => {
  const c = getAuthState()?.user?.color;
  if (c && c.trim() !== "") return c;
  return DEFAULT_PARTICIPANT_COLOR;
});

const collaborationEnabled = computed(() =>
  Boolean(props.room?.id && props.apiBaseURL),
);

const meetCollab = useMeetRoomYCollaboration({
  room: toRef(props, "room"),
  apiBaseURL: toRef(props, "apiBaseURL"),
  userId: toRef(props, "participantName"),
  userName: toRef(props, "participantName"),
  userColor: participantColorForDocument,
  enabled: collaborationEnabled,
});

provide(MEET_ROOM_COLLABORATION_KEY, meetCollab);

const WB_ROOM_OPEN_PREFIX = "nonza_meet_wb_open_";

function readStoredWhiteboardOpen(roomId: string | undefined): boolean {
  if (!roomId) return false;
  try {
    return localStorage.getItem(WB_ROOM_OPEN_PREFIX + roomId) === "1";
  } catch {
    return false;
  }
}

function writeStoredWhiteboardOpen(roomId: string | undefined, open: boolean) {
  if (!roomId) return;
  try {
    localStorage.setItem(WB_ROOM_OPEN_PREFIX + roomId, open ? "1" : "0");
  } catch {
    /* ignore */
  }
}

const isDocumentOpen = ref(false);
function toggleDocument() {
  isDocumentOpen.value = !isDocumentOpen.value;
}

const isWhiteboardOpen = ref(false);

watch(
  () => [props.room?.id, collaborationEnabled.value] as const,
  ([id, collab]) => {
    if (!id || !collab) return;
    isWhiteboardOpen.value = readStoredWhiteboardOpen(id);
  },
  { immediate: true },
);

watch(
  () => [props.room?.id, isWhiteboardOpen.value] as const,
  () => {
    writeStoredWhiteboardOpen(props.room?.id, isWhiteboardOpen.value);
  },
);

function toggleWhiteboard() {
  isWhiteboardOpen.value = !isWhiteboardOpen.value;
}

const WB_FULLSCREEN_KEY = "nonza_settings_wb_fullscreen";

function readWbFullscreen(): boolean {
  try {
    const v = localStorage.getItem(WB_FULLSCREEN_KEY);
    if (v === null) return false;
    return v === "1";
  } catch {
    return false;
  }
}

const whiteboardFullscreen = ref(readWbFullscreen());

const sideCollabVisible = computed(
  () =>
    collaborationEnabled.value &&
    (isDocumentOpen.value ||
      (isWhiteboardOpen.value && !whiteboardFullscreen.value)),
);

const participantsKey = ref(0);
const allParticipants = computed(() => {
  void participantsKey.value;
  const list: (LocalParticipant | RemoteParticipant)[] = [];
  if (localParticipant.value) list.push(localParticipant.value);
  return [...list, ...remoteParticipants.value];
});

const allParticipantIdentities = computed(() =>
  allParticipants.value.map((p) => p.identity),
);

const { orderedIdentities, moveInOrder } = useTableCircle(
  () => localParticipant.value,
  () => allParticipantIdentities.value,
  () => props.livekitRoom,
);

const conferenceHall = useConferenceHall(
  () => localParticipant.value,
  () => remoteParticipants.value,
  () => props.participantName,
  () => props.livekitRoom,
  undefined,
  {
    initialLeaderIdentity: () => props.room?.conference_hall_leader_id ?? null,
    onLeaderChange: (leaderIdentity) => {
      const code = props.room?.short_code ?? null;
      if (!code || !props.roomApi) return;

      const currentOnServer = props.room?.conference_hall_leader_id ?? null;
      if (leaderIdentity === currentOnServer) return;

      props.roomApi.updateConferenceHallLeader(code, leaderIdentity).catch(() => {});
    },
  },
);

const leaderIdentity = computed(
  () => conferenceHall.leader.value?.identity ?? null,
);

const participantsByIdentity = computed(() => {
  const map = new Map<string, LocalParticipant | RemoteParticipant>();
  for (const p of allParticipants.value) map.set(p.identity, p);
  return map;
});

const tableParticipantsOrdered = computed(() => {
  const map = participantsByIdentity.value;
  return orderedIdentities.value.map((id) => map.get(id)).filter(Boolean) as (
    | LocalParticipant
    | RemoteParticipant
  )[];
});

const ringCount = computed(() => Math.max(tableParticipantsOrdered.value.length || 1, 1));

const edgeInsetPercent = 10;

const seatWidthPx = computed(() => {
  const n = ringCount.value;
  const w = 520 / n;
  return Math.round(Math.max(52, Math.min(108, w)));
});

const seatHeightPx = computed(() => Math.round(seatWidthPx.value * 0.86));

const ringStyle = computed(() => ({
  "--ring-n": `${ringCount.value}`,
  "--edge-inset": `${edgeInsetPercent}%`,
}) as Record<string, string>);

const centerSizePercent = computed(() => {
  // Чем больше людей, тем меньше центр, чтобы не налезало на периметр.
  const n = ringCount.value;
  const size = 52 - n * 2.15;
  return Math.max(30, Math.min(48, size));
});

const centerStyle = computed(
  () =>
    ({
      "--center-size": `${centerSizePercent.value}%`,
    }) as Record<string, string>,
);

function seatPositionStyle(index: number) {
  const n = ringCount.value;
  if (n <= 0) return {};
  const inset = edgeInsetPercent;
  const span = 100 - 2 * inset;

  // Идём по часовой вдоль периметра квадрата.
  const f = index / n; // [0..1)
  const t = f * 4; // 0..4
  const edge = Math.floor(t) % 4; // 0 top, 1 right, 2 bottom, 3 left
  const u = t - edge; // [0..1)

  let x = inset;
  let y = inset;
  if (edge === 0) {
    // Top
    x = inset + u * span;
    y = inset;
  } else if (edge === 1) {
    // Right
    x = inset + span;
    y = inset + u * span;
  } else if (edge === 2) {
    // Bottom
    x = inset + span - u * span;
    y = inset + span;
  } else {
    // Left
    x = inset;
    y = inset + span - u * span;
  }

  return {
    "--seat-x": `${x}%`,
    "--seat-y": `${y}%`,
    "--seat-w": `${seatWidthPx.value}px`,
    "--seat-h": `${seatHeightPx.value}px`,
  } as Record<string, string>;
}

const previewNames = ["Alice", "Bob", "Charlie"];
function seatPositionStylePreview(index: number) {
  const n = previewNames.length;
  const inset = edgeInsetPercent;
  const span = 100 - 2 * inset;

  const f = index / n;
  const t = f * 4;
  const edge = Math.floor(t) % 4;
  const u = t - edge;

  let x = inset;
  let y = inset;
  if (edge === 0) {
    x = inset + u * span;
    y = inset;
  } else if (edge === 1) {
    x = inset + span;
    y = inset + u * span;
  } else if (edge === 2) {
    x = inset + span - u * span;
    y = inset + span;
  } else {
    x = inset;
    y = inset + span - u * span;
  }

  const w = Math.round(Math.max(52, Math.min(108, 520 / n)));
  const h = Math.round(w * 0.86);
  return {
    "--seat-x": `${x}%`,
    "--seat-y": `${y}%`,
    "--seat-w": `${w}px`,
    "--seat-h": `${h}px`,
  } as Record<string, string>;
}

const isLocal = (p: LocalParticipant | RemoteParticipant) =>
  localParticipant.value?.identity === p.identity;

const speakingIdentitySet = ref<Set<string>>(new Set());
watch(
  () => props.livekitRoom,
  (room) => {
    speakingIdentitySet.value = new Set();
    if (!room) return;
    const handler = (speakers: Array<{ identity: string }>) => {
      speakingIdentitySet.value = new Set(speakers.map((s) => s.identity));
    };
    room.on(RoomEvent.ActiveSpeakersChanged, handler);
    return () => room.off(RoomEvent.ActiveSpeakersChanged, handler);
  },
  { immediate: true },
);

watch(
  () => props.livekitRoom,
  (room) => {
    if (!room) return;
    const handleMetadataChanged = () => {
      participantsKey.value++;
    };
    room.on(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);
    return () => room.off(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);
  },
  { immediate: true },
);

const { replicaByParticipant, sendReplica } = useParticipantReplica(
  computed(() => props.livekitRoom),
  {},
);

function handleReplicaSubmit(payload: {
  text: string;
  accept: () => void;
}): void {
  if (sendReplica(payload.text)) payload.accept();
}

const { state: mediaState, toggleVideo, toggleAudio, toggleScreenShare } = useMediaControl(
  localParticipant,
  computed(() => props.livekitRoom),
);

const highlightedIdentity = ref<string | null>(null);
function highlight(identity: string | null) {
  if (!identity) return;
  highlightedIdentity.value = identity;
  window.clearTimeout((highlight as any)._t);
  (highlight as any)._t = window.setTimeout(() => {
    if (highlightedIdentity.value === identity) highlightedIdentity.value = null;
  }, 900);
}

const order = orderedIdentities;
const localSeatIndex = computed(() => {
  const local = localParticipant.value?.identity;
  if (!local) return -1;
  const idx = order.value.indexOf(local);
  return idx >= 0 ? idx : -1;
});
const nSeats = computed(() => order.value.length);
const targetLeftIdentity = computed(() => {
  const i = localSeatIndex.value;
  if (i < 0 || nSeats.value < 2) return null;
  const idx = (i + 1) % nSeats.value;
  return order.value[idx] ?? null;
});
const targetRightIdentity = computed(() => {
  const i = localSeatIndex.value;
  if (i < 0 || nSeats.value < 2) return null;
  const idx = (i - 1 + nSeats.value) % nSeats.value;
  return order.value[idx] ?? null;
});
const targetOppositeIdentity = computed(() => {
  const i = localSeatIndex.value;
  const n = nSeats.value;
  if (i < 0 || n < 2) return null;
  const idx = (i + Math.floor(n / 2)) % n;
  return order.value[idx] ?? null;
});

const settingsOpen = ref(false);
const audioSettingsRef = ref<InstanceType<typeof AudioSettings> | null>(null);
const centerContent = ref<"dice" | "stream" | "chat">("chat");

watch(
  () => props.room?.id,
  (id) => {
    if (!id) {
      centerContent.value = "chat";
      return;
    }
    centerContent.value = readTableCircleCenterForRoom(id);
  },
  { immediate: true },
);

watch(
  () => [props.room?.id, centerContent.value] as const,
  () => {
    writeTableCircleCenterForRoom(props.room?.id, centerContent.value);
  },
);

const leaderParticipant = computed(() => {
  const id = leaderIdentity.value;
  if (!id) return null;
  if (localParticipant.value?.identity === id) return localParticipant.value;
  return remoteParticipants.value.find((p) => p.identity === id) ?? null;
});

const leaderParticipantName = computed(() => {
  const p = leaderParticipant.value;
  if (!p) return "";
  return isLocal(p) ? props.participantName : (props.getDisplayName?.(p) ?? p.name ?? p.identity);
});

function handleSettings() {
  settingsOpen.value = true;
}

const activeCallWidgetIds = computed<CallWidgetId[]>(() => {
  const ids: CallWidgetId[] = [];
  if (isDocumentOpen.value) ids.push("document");
  if (isWhiteboardOpen.value) ids.push("whiteboard");
  if (isSoundBarPanelOpen.value) ids.push("soundbar");
  if (centerContent.value === "chat") ids.push("table_chat");
  if (centerContent.value === "dice") ids.push("table_dice");
  if (centerContent.value === "stream") ids.push("table_stream");
  return ids;
});

function activateCallWidgetFromMenu(id: CallWidgetId): void {
  switch (id) {
    case "document":
      toggleDocument();
      break;
    case "whiteboard":
      toggleWhiteboard();
      break;
    case "table_chat":
      centerContent.value = "chat";
      break;
    case "table_dice":
      centerContent.value = "dice";
      break;
    case "table_stream":
      centerContent.value = "stream";
      break;
    case "soundbar":
      isSoundBarPanelOpen.value = !isSoundBarPanelOpen.value;
      break;
    case "settings":
      handleSettings();
      break;
    default:
      break;
  }
}

const handleDisconnect = () => emit("disconnect");
</script>

<style scoped>
.table-circle {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.table-circle__content {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 12px 12px 120px;
}

.table-circle__main-row {
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: 1440px;
  gap: 12px;
  align-items: stretch;
  justify-content: center;
}

.table-circle__main-row--with-collab .table-circle__board {
  max-width: min(720px, 52vw);
}

.table-circle__collab-column {
  flex: 0 0 min(380px, 42vw);
  min-width: 0;
  max-height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.table-circle__collab-block {
  flex: 0 0 auto;
  min-height: 0;
}

.table-circle__collab-block--document {
  min-height: 260px;
}

.table-circle__collab-block--whiteboard {
  min-height: 220px;
}

.table-circle__board {
  position: relative;
  width: 100%;
  max-width: 980px;
  aspect-ratio: 1 / 1;
  max-height: 100%;
  min-height: 0;
}

.table-circle__center {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: var(--center-size, 38%);
  height: var(--center-size, 38%);
  border: 2px solid #444;
  border-radius: 0;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.25);
  overflow: visible;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  z-index: 3;
}

.table-circle__sound-panel {
  position: absolute;
  inset: 0;
  z-index: 6;
  min-height: 0;
  padding: 8px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: #101010f0;
  border: 2px solid #444;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.table-circle__center-body {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.table-circle__center-body > * {
  flex: 1;
  min-height: 0;
}

.table-circle__center-video {
  width: 100%;
  height: 100%;
}

.table-circle__center-placeholder {
  padding: 16px;
  text-align: center;
  font-size: 14px;
}

.table-circle__ring {
  position: absolute;
  inset: 0;
  overflow: hidden;
  z-index: 1;
}

.table-circle__ring::before {
  content: "";
  position: absolute;
  left: var(--edge-inset, 10%);
  top: var(--edge-inset, 10%);
  width: calc(100% - (2 * var(--edge-inset, 10%)));
  height: calc(100% - (2 * var(--edge-inset, 10%)));
  border-radius: 0;
  border: 2px dashed #333;
  pointer-events: none;
  z-index: 0;
}

.table-circle__public-table {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.table-circle__public-table > * {
  flex: 1;
  min-height: 0;
}

.table-circle__leader-stream {
  width: 100%;
  height: 100%;
}

.table-circle__seat-wrap {
  position: absolute;
  left: var(--seat-x, 50%);
  top: var(--seat-y, 50%);
  transform: translate(-50%, -50%);
  width: var(--seat-w, 100px);
  height: var(--seat-h, 88px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.table-circle__seat {
  position: relative;
  width: 100%;
  height: 100%;
  border: 2px solid #444;
  border-radius: 0;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), #101010 70%);
}

.table-circle__seat--highlight {
  outline: 2px solid #ffc866;
  outline-offset: 2px;
}

.table-circle__avatar {
  width: 100%;
  height: 100%;
}
.table-circle__avatar :deep(.player),
.table-circle__avatar :deep(.player-avatar) {
  width: 100%;
  height: 100%;
  min-height: 0;
}
.table-circle__avatar :deep(.player-avatar__letter) {
  font-size: 1.1rem;
}

.table-circle__seat-num {
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 3;
  padding: 2px 6px;
  border-radius: 0;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #ccc;
  font-size: 10px;
  font-weight: 700;
  pointer-events: none;
}

.table-circle__seat-host {
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: #ffc866;
  white-space: nowrap;
}

.table-circle__seat-actions {
  position: absolute;
  top: 2px;
  right: 2px;
  display: flex;
  gap: 2px;
}

.table-circle__host-badge {
  font-size: 12px;
  margin-right: 8px;
}

.table-circle__quick-target {
  display: flex;
  gap: 8px;
  align-items: center;
}

.table-circle__center-mode {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  align-items: center;
  padding: 4px;
  border: 1px solid #333;
  background: #141414;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.3);
  z-index: 4;
  max-width: calc(100vw - 24px);
}

@media (max-width: 639px) {
  .table-circle__center-mode {
    display: none;
  }
}

.table-circle__settings {
  padding: 12px;
}

@media (max-width: 900px) {
  .table-circle__main-row {
    flex-direction: column;
    align-items: stretch;
  }

  .table-circle__main-row--with-collab .table-circle__board {
    max-width: 980px;
    width: 100%;
  }

  .table-circle__collab-column {
    flex: 0 0 auto;
    width: 100%;
    max-width: 100%;
    max-height: min(48vh, 420px);
  }
}
</style>

