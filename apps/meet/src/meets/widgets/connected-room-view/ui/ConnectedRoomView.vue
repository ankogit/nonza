<template>
  <RoomConferenceHall
    v-if="displayRoomType === 'conference_hall'"
    ref="roomRef"
    :room="room"
    :room-api="roomApi"
    :livekit-room="livekitRoom as any"
    :local-participant="localParticipant as any"
    :remote-participants="remoteParticipants"
    :get-display-name="getDisplayName"
    :participant-name="participantName"
    :api-base-u-r-l="apiBaseURL"
    :show-document="false"
    :hide-sidebar="hideSidebar"
    :settings-in-call-menu="false"
    :settings-in-upper-menu="settingsInUpperMenu"
    :update-participant-name="updateParticipantName"
    @disconnect="emit('disconnect')"
    @update:participantName="(name: string) => emit('update:participantName', name)"
    @update:participants="(list) => emit('update:participants', list)"
  />
  <RoomRoundTable
    v-else-if="displayRoomType === 'round_table'"
    ref="roomRef"
    :room="room"
    :livekit-room="livekitRoom as any"
    :local-participant="localParticipant as any"
    :remote-participants="remoteParticipants"
    :get-display-name="getDisplayName"
    :participant-name="participantName"
    :api-base-u-r-l="apiBaseURL"
    :show-document="showDocument"
    :settings-in-call-menu="false"
    :settings-in-upper-menu="settingsInUpperMenu"
    :update-participant-name="updateParticipantName"
    @disconnect="emit('disconnect')"
    @update:participantName="(name: string) => emit('update:participantName', name)"
  />
  <div v-else class="connected-room-view__unsupported">
    Тип комнаты "{{ room?.room_type }}" пока не поддерживается
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { RoomConferenceHall } from "@widgets/room-conference-hall";
import { RoomRoundTable } from "@widgets/room-round-table";
import type { Room as RoomEntity } from "@shared/entities";
import type { RoomApi } from "@shared/entities";
import type { Room as LiveKitRoom, RemoteParticipant, LocalParticipant } from "livekit-client";
import type { DisplayRoomType } from "@shared/lib";
import type { RoomParticipantListItem } from "@widgets/room-participants-list";

const props = defineProps<{
  room: RoomEntity | null;
  displayRoomType: DisplayRoomType | null;
  roomApi?: RoomApi | null;
  livekitRoom: LiveKitRoom | null;
  localParticipant: LocalParticipant | null;
  remoteParticipants: RemoteParticipant[];
  getDisplayName: (p: RemoteParticipant | LocalParticipant) => string;
  participantName: string;
  apiBaseURL: string;
  showDocument?: boolean;
  hideSidebar?: boolean;
  updateParticipantName?: (name: string) => void;
}>();

const settingsInUpperMenu = computed(() => !props.hideSidebar);

const roomRef = ref<InstanceType<typeof RoomConferenceHall> | InstanceType<typeof RoomRoundTable> | null>(null);

defineExpose({
  openCallSettings: () => (roomRef.value as { openCallSettings?: () => void })?.openCallSettings?.(),
});

watch(
  () => props.displayRoomType,
  (t) => console.log("[ConnectedRoomView] render view:", t ?? "unsupported"),
  { immediate: true },
);

const emit = defineEmits<{
  disconnect: [];
  "update:participantName": [name: string];
  "update:participants": [RoomParticipantListItem[]];
}>();
</script>

<style scoped>
.connected-room-view__unsupported {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #999;
}
</style>
