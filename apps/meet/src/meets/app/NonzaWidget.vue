<template>
  <div class="nonza-widget" :class="{ 'nonza-widget--connected': isConnected }">
    <div v-if="isReconnecting" class="nonza-widget__reconnecting">
      <div class="nonza-widget__reconnecting-card">
        <p class="nonza-widget__reconnecting-text">
          Восстанавливаем подключение
        </p>
        <p class="nonza-widget__reconnecting-hint">
          Соединение с комнатой было потеряно
        </p>
        <Button
          type="text"
          variant="accent"
          size="medium"
          :disabled="isConnecting"
          class="nonza-widget__reconnecting-button"
          @click="handleReconnect"
        >
          {{ isConnecting ? "Подключение..." : "Переподключиться" }}
        </Button>
        <div v-if="connectionState.error" class="nonza-widget__error">
          {{ connectionState.error }}
        </div>
      </div>
    </div>
    <div v-else-if="!isConnected" class="nonza-widget__connect">
      <template v-if="entryMode === 'by_selection'">
        <div
          v-if="!passwordRequired"
          class="nonza-widget__reconnecting-card nonza-widget__connect-form"
        >
          <p class="nonza-widget__reconnecting-text">
            {{ isConnecting ? "Подключение..." : "Подготовка..." }}
          </p>
        </div>
      </template>
      <template v-else>
        <div
          v-if="isRoomNotFound"
          class="nonza-widget__reconnecting-card nonza-widget__connect-form"
        >
          <h2 class="nonza-widget__title">Комната не найдена</h2>
          <p class="nonza-widget__reconnecting-hint">
            Проверьте код комнаты или перейдите к списку организаций.
          </p>
          <Button
            v-if="defaultShortCode"
            type="text"
            variant="accent"
            size="medium"
            class="nonza-widget__form-button"
            @click="handleRoomNotFoundBack"
          >
            К списку организаций
          </Button>
          <Button
            v-else
            type="text"
            variant="accent"
            size="medium"
            class="nonza-widget__form-button"
            @click="handleTryAnotherCode"
          >
            Ввести другой код
          </Button>
        </div>
        <div
          v-else-if="isConnecting && !error"
          class="nonza-widget__reconnecting-card nonza-widget__connect-form"
        >
          <p class="nonza-widget__reconnecting-text">Подключение...</p>
        </div>
        <form
          v-else
          class="nonza-widget__connect-form"
          autocomplete="on"
          @submit.prevent="handleConnect"
        >
          <h2 class="nonza-widget__title">Присоединиться к комнате</h2>
          <div class="nonza-widget__input-group nonza-widget__input-group--full">
            <label for="shortCode">Код комнаты</label>
            <input
              id="shortCode"
              v-model="shortCode"
              type="text"
              placeholder="abc-defg-hij"
              class="nonza-widget__input"
            />
          </div>
          <div v-if="!isAuthParticipant" class="nonza-widget__input-group">
            <label for="participantName">Ваше имя</label>
            <div class="nonza-widget__input-with-button">
              <input
                id="participantName"
                v-model="participantName"
                type="text"
                placeholder="Введите ваше имя"
                class="nonza-widget__input"
              />
              <Button
                type="icon"
                size="small"
                class="nonza-widget__randomize-button"
                :title="'Сгенерировать случайное имя'"
                aria-label="Сгенерировать случайное имя"
                @click="handleRandomizeName"
              >
                <PixelIcon name="reload" variant="large" />
              </Button>
            </div>
          </div>
          <div v-else class="nonza-widget__input-group">
            <label for="participantName">Участник</label>
            <input
              id="participantName"
              :value="displayParticipantName"
              type="text"
              readonly
              class="nonza-widget__input nonza-widget__input--readonly"
            />
          </div>
          <div
            v-if="showPasswordField"
            class="nonza-widget__input-group nonza-widget__input-group--full"
          >
            <label for="roomPassword">Пароль комнаты</label>
            <input
              id="roomPassword"
              v-model="roomPassword"
              type="password"
              placeholder="Введите пароль"
              class="nonza-widget__input"
              autocomplete="current-password"
            />
          </div>
          <Button
            type="text"
            native-type="submit"
            variant="accent"
            size="medium"
            :disabled="!canConnect || isConnecting"
            class="nonza-widget__form-button"
          >
            {{ isConnecting ? "Подключение..." : "Присоединиться" }}
          </Button>
          <hr class="HR" />
          <Button
            type="text"
            native-type="button"
            variant="default"
            size="medium"
            class="nonza-widget__form-button"
            @click="handleCreateRoom"
          >
            Создать комнату
          </Button>
          <div v-if="error" class="nonza-widget__error">{{ error }}</div>
        </form>
      </template>
    </div>

    <div
      v-else-if="currentRoom && connectionState.livekitRoom"
      class="nonza-widget__room"
    >
      <ConnectedRoomView
        ref="connectedRoomViewRef"
        :key="`${currentRoom?.id ?? ''}-${displayRoomType ?? 'unknown'}`"
        :room="currentRoom"
        :display-room-type="displayRoomType"
        :room-api="roomApi"
        :livekit-room="connectionState.livekitRoom"
        :local-participant="localParticipant"
        :remote-participants="remoteParticipants"
        :get-display-name="getDisplayName"
        :participant-name="displayParticipantName"
        :api-base-u-r-l="props.apiBaseURL"
        :show-document="displayRoomType === 'round_table'"
        :hide-sidebar="hideSidebar"
        :update-participant-name="updateParticipantName"
        @disconnect="handleDisconnect"
        @update:participantName="onUpdateParticipantName"
        @update:participants="(list) => (participantsFromView = list)"
      />
    </div>

    <Modal
      :model-value="entryMode === 'by_selection' && passwordRequired"
      title="Пароль комнаты"
      :close-on-overlay-click="false"
      @update:model-value="onRoomPasswordModalClose"
    >
      <form
        id="nonza-widget-password-form"
        class="nonza-widget__password-form"
        autocomplete="on"
        @submit.prevent="handleConnect"
      >
        <label for="roomPasswordModal" class="nonza-widget__password-label">Пароль</label>
        <input
          id="roomPasswordModal"
          v-model="roomPassword"
          type="password"
          placeholder="Введите пароль"
          class="nonza-widget__input"
          autocomplete="current-password"
        />
        <div v-if="error" class="nonza-widget__error">{{ error }}</div>
      </form>
      <template #footer>
        <Button
          type="text"
          native-type="button"
          variant="default"
          size="small"
          @click="onRoomPasswordModalClose"
        >
          Отмена
        </Button>
        <Button
          type="text"
          native-type="submit"
          variant="accent"
          size="small"
          form="nonza-widget-password-form"
          :disabled="!roomPassword.trim() || isConnecting"
        >
          {{ isConnecting ? "Подключение..." : "Подключиться" }}
        </Button>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { RoomEvent } from "livekit-client";
import { useRoomConnection } from "@features/room-connection";
import { useScreenWakeLock, resolveDisplayRoomType } from "@shared/lib";
import { ConnectedRoomView } from "@widgets/connected-room-view";
import { RoomApi } from "@shared/entities";
import { Button, PixelIcon, Modal } from "@shared/ui";
import {
  getParticipantName,
  setParticipantName,
  generateParticipantName,
  getRoomShortCode,
  setRoomShortCode,
  clearRoomShortCode,
  getStoredRoomPassword,
  setStoredRoomPassword,
  clearStoredRoomPassword,
  parseParticipantColorFromMetadata,
  DEFAULT_PARTICIPANT_COLOR,
} from "@shared/lib";
import type { ParticipantInfo } from "@shared/lib";
import type { Room as RoomEntity } from "@shared/entities";
import type { RoomParticipantListItem } from "@widgets/room-participants-list";

const props = withDefaults(
  defineProps<{
    apiClient: import("@shared/api").ApiClient;
    apiBaseURL: string;
    livekitURL: string;
    defaultShortCode?: string;
    defaultParticipantName?: string;
    getParticipantInfo?: () => ParticipantInfo | null;
    hideSidebar?: boolean;
    roomTypeHint?: import("@shared/lib").RoomType;
    entryMode?: "by_code" | "by_selection";
    connectOnMount?: boolean;
    syncUrlWithRoomCode?: boolean;
    room?: RoomEntity | null;
  }>(),
  { syncUrlWithRoomCode: false }
);

const emit = defineEmits<{
  disconnect: [];
  "update:participants": [RoomParticipantListItem[]];
}>();

const connectedRoomViewRef = ref<InstanceType<typeof ConnectedRoomView> | null>(null);
const participantsFromView = ref<RoomParticipantListItem[] | null>(null);

const roomApi = new RoomApi(props.apiClient);
const {
  state: connectionState,
  localParticipant,
  remoteParticipants,
  getDisplayName,
  connect,
  reconnect,
  disconnect,
  updateParticipantMetadata,
  updateParticipantName,
} = useRoomConnection(roomApi);

function updateParticipantColor(color: string | null) {
  updateParticipantMetadata({ color: color ?? DEFAULT_PARTICIPANT_COLOR });
}

const livekitRoom = computed(() => connectionState.value.livekitRoom);

defineExpose({
  openCallSettings: () => connectedRoomViewRef.value?.openCallSettings?.(),
  updateParticipantColor,
  updateParticipantName,
  disconnect,
  livekitRoom,
});

const urlParams = new URLSearchParams(window.location.search);
const urlCode = props.syncUrlWithRoomCode ? urlParams.get("code") : null;
const forceRelay = ["1", "true"].includes(
  urlParams.get("relay")?.toLowerCase() ?? ""
);

const shortCode = ref(props.defaultShortCode || urlCode || "");
const participantName = ref(
  getParticipantName() || props.defaultParticipantName || ""
);

const effectiveParticipantInfo = computed((): ParticipantInfo | null =>
  props.getParticipantInfo?.() ?? null
);

const isAuthParticipant = computed(() => effectiveParticipantInfo.value != null);

const displayParticipantName = computed(() =>
  effectiveParticipantInfo.value?.displayName ?? participantName.value
);

watch(
  participantName,
  (name) => {
    if (name.trim()) setParticipantName(name);
  },
  { immediate: false }
);
const error = ref<string | null>(null);
const connectedRoom = ref<RoomEntity | null>(null);
const passwordRequired = ref(false);
const roomPassword = ref("");

const showPasswordField = computed(
  () => passwordRequired.value || (props.room?.password_protected ?? false)
);

const currentRoom = computed(() => connectionState.value.room);

const entryMode = computed(
  (): "by_code" | "by_selection" => props.entryMode ?? "by_code"
);

const displayRoomType = computed(() => {
  const room = currentRoom.value;
  if (room?.room_type != null) {
    return resolveDisplayRoomType(room, null);
  }
  return resolveDisplayRoomType(null, props.roomTypeHint);
});

const isConnecting = computed(() => connectionState.value.isConnecting);
const isConnected = computed(() => connectionState.value.isConnected);
const isReconnecting = computed(() => connectionState.value.isReconnecting);

function isNotFoundError(msg: string): boolean {
  return /404|not found|не найдена/i.test(msg);
}

const isRoomNotFound = computed(() => {
  if (roomNotFoundDismissed.value) return false;
  const err = error.value ?? connectionState.value.error;
  if (!err) return false;
  const code = (props.defaultShortCode ?? urlCode ?? shortCode.value).toString().trim();
  return code.length > 0 && isNotFoundError(err);
});

const defaultShortCode = computed(() =>
  (props.defaultShortCode ?? urlCode ?? "").toString().trim()
);

const roomNotFoundDismissed = ref(false);
const userHasLeftRoom = ref(false);

const speakingIdentitySet = ref<Set<string>>(new Set());
watch(
  () => connectionState.value.livekitRoom,
  (room) => {
    speakingIdentitySet.value = new Set();
    if (!room) return;
    const handler = (speakers: Array<{ identity: string }>) => {
      speakingIdentitySet.value = new Set(speakers.map((s) => s.identity));
    };
    room.on(RoomEvent.ActiveSpeakersChanged, handler);
    return () => {
      room.off(RoomEvent.ActiveSpeakersChanged, handler);
    };
  },
  { immediate: true },
);

const roomParticipantsList = computed<RoomParticipantListItem[]>(() => {
  const room = connectionState.value.livekitRoom;
  const local = localParticipant.value;
  const remotes = remoteParticipants.value;
  if (!room || (!local && remotes.length === 0)) return [];
  const list: RoomParticipantListItem[] = [];
  if (local) {
    const name = getDisplayName(local);
    list.push({
      identity: local.identity,
      participantName: name,
      participant: local,
      participantColor: parseParticipantColorFromMetadata(
        (local as { metadata?: string }).metadata,
        name,
      ),
      isSpeaking: speakingIdentitySet.value.has(local.identity),
    });
  }
  remotes.forEach((p) => {
    const name = getDisplayName(p);
    list.push({
      identity: p.identity,
      participantName: name,
      participant: p,
      participantColor: parseParticipantColorFromMetadata(
        (p as { metadata?: string }).metadata,
        name,
      ),
      isSpeaking: speakingIdentitySet.value.has(p.identity),
    });
  });
  return list;
});

watch(
  [roomParticipantsList, participantsFromView, displayRoomType],
  () => {
    const list =
      displayRoomType.value === "conference_hall" && participantsFromView.value != null
        ? participantsFromView.value
        : roomParticipantsList.value;
    emit("update:participants", list as RoomParticipantListItem[]);
  },
  { immediate: true, deep: true },
);

watch(displayRoomType, (t) => {
  if (t !== "conference_hall") participantsFromView.value = null;
});

const inCall = computed(
  () =>
    isConnected.value &&
    !!connectedRoom.value &&
    !!connectionState.value.livekitRoom
);

const wakeLock = useScreenWakeLock({ active: () => inCall.value });
watch(
  inCall,
  (active) => {
    if (active) wakeLock.requestLock();
    else wakeLock.releaseLock();
  },
  { immediate: true }
);
onMounted(() => {
  document.addEventListener("visibilitychange", wakeLock.onVisibilityChange);
});
onUnmounted(() => {
  document.removeEventListener("visibilitychange", wakeLock.onVisibilityChange);
  wakeLock.releaseLock();
  if (entryMode.value === "by_selection" && connectionState.value.isConnected) {
    const code = connectionState.value.room?.short_code ?? shortCode.value?.trim();
    if (code) {
      roomApi.notifyParticipantLeft(code).catch(() => {});
    }
    disconnect();
  }
});

const canConnect = computed(() => {
  const code = shortCode.value.trim();
  if (!code) return false;
  if (isAuthParticipant.value) return true;
  return participantName.value.trim().length > 0;
});

const SHORT_CODE_REGEX = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i;
function looksLikeFullShortCode(code: string): boolean {
  return SHORT_CODE_REGEX.test(code.trim());
}

function replaceUrlRoomCode(code: string | null) {
  if (!props.syncUrlWithRoomCode) return;
  const params = new URLSearchParams(window.location.search);
  if (code) {
    params.set("code", code);
  } else {
    params.delete("code");
  }
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
  window.history.replaceState(null, "", url);
}

const handleConnect = async (ev?: unknown) => {
  const passwordOverride = typeof ev === "string" ? ev : undefined;
  if (!canConnect.value) return;

  userHasLeftRoom.value = false;
  roomNotFoundDismissed.value = false;
  error.value = null;
  const code = shortCode.value.trim();
  const info = effectiveParticipantInfo.value;
  const name = info?.displayName ?? participantName.value.trim();
  const identity = info?.identity;
  const password =
    (typeof passwordOverride === "string" ? passwordOverride : null) ??
    (roomPassword.value.trim() || undefined);

  try {
    await connect(code, name, props.livekitURL, {
      ...(forceRelay && { iceTransportPolicy: "relay" }),
      password,
    }, identity);
    connectedRoom.value = connectionState.value.room;
    passwordRequired.value = false;
    roomPassword.value = "";
    if (password) setStoredRoomPassword(code, password);
    setRoomShortCode(code);
    replaceUrlRoomCode(connectionState.value.room?.short_code ?? code);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Не удалось подключиться";
    if (msg === "password_required") {
      const stored = getStoredRoomPassword(code);
      if (stored) {
        try {
          await connect(code, name, props.livekitURL, {
            ...(forceRelay && { iceTransportPolicy: "relay" }),
            password: stored,
          }, identity);
          connectedRoom.value = connectionState.value.room;
          passwordRequired.value = false;
          roomPassword.value = "";
          setRoomShortCode(code);
          replaceUrlRoomCode(connectionState.value.room?.short_code ?? code);
          return;
        } catch (retryErr) {
          const retryMsg = retryErr instanceof Error ? retryErr.message : "";
          if (retryMsg === "wrong_password") {
            clearStoredRoomPassword(code);
          }
        }
      }
      passwordRequired.value = true;
      userHasLeftRoom.value = true;
    } else if (msg === "wrong_password") {
      clearStoredRoomPassword(code);
      error.value = "Неверный пароль";
    } else {
      error.value = msg;
    }
  }
};

const handleReconnect = async () => {
  userHasLeftRoom.value = false;
  error.value = null;
  try {
    await reconnect();
    connectedRoom.value = connectionState.value.room;
    replaceUrlRoomCode(connectionState.value.room?.short_code ?? (shortCode.value?.trim() || null));
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "Не удалось переподключиться";
  }
};

const handleDisconnect = async () => {
  const code = connectionState.value.room?.short_code ?? shortCode.value?.trim();
  if (code) {
    roomApi.notifyParticipantLeft(code).catch(() => {});
  }
  await disconnect();
  connectedRoom.value = null;
  error.value = null;
  passwordRequired.value = false;
  roomPassword.value = "";
  clearRoomShortCode();
  replaceUrlRoomCode(null);
  userHasLeftRoom.value = true;
  emit("disconnect");
};

function handleRoomNotFoundBack() {
  error.value = null;
  passwordRequired.value = false;
  roomPassword.value = "";
  shortCode.value = "";
  clearRoomShortCode();
  replaceUrlRoomCode(null);
  emit("disconnect");
}

function onRoomPasswordModalClose() {
  passwordRequired.value = false;
  roomPassword.value = "";
  error.value = null;
  emit("disconnect");
}

function handleTryAnotherCode() {
  roomNotFoundDismissed.value = true;
  error.value = null;
  passwordRequired.value = false;
  roomPassword.value = "";
  shortCode.value = "";
}

const handleCreateRoom = () => {
  window.location.href = "/?create=true";
};

const handleRandomizeName = () => {
  const name = generateParticipantName();
  participantName.value = name;
  setParticipantName(name);
};

function onUpdateParticipantName(name: string) {
  if (!isAuthParticipant.value) participantName.value = name;
}

onMounted(() => {
  const savedShortCode = getRoomShortCode()?.trim();
  const savedName = getParticipantName()?.trim();
  if (savedShortCode && savedName && entryMode.value !== "by_selection") {
    shortCode.value = savedShortCode;
    participantName.value = savedName;
  } else if (savedName) {
    participantName.value = savedName;
  }
  if (props.connectOnMount) {
    nextTick(() => {
      const code = shortCode.value.trim();
      const info = effectiveParticipantInfo.value;
      const name = info?.displayName ?? participantName.value.trim();
      if (
        looksLikeFullShortCode(code) &&
        name &&
        !connectionState.value.isConnected &&
        !connectionState.value.isConnecting
      ) {
        handleConnect();
      }
    });
  }
});
</script>

<style scoped>
.nonza-widget {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

@media (min-width: 768px) and (min-height: 600px) {
  .nonza-widget {
    min-height: 600px;
  }
}

.nonza-widget__reconnecting,
.nonza-widget__connect {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  min-height: 0;
  overflow-y: auto;
}

.nonza-widget__reconnecting-card {
  width: 100%;
  max-width: 400px;
  background: var(--color-surface, #2a2a2a);
  padding: 32px;
  border: 2px solid #444;
  border-radius: 0;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.3);
  text-align: center;
}

.nonza-widget__reconnecting-text {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 500;
  color: white;
}

.nonza-widget__reconnecting-hint {
  margin: 0 0 24px 0;
  font-size: 14px;
  color: #999;
}

.nonza-widget__reconnecting-button {
  width: 100%;
}

.nonza-widget__connect-form {
  width: 100%;
  max-width: 400px;
  background: var(--color-surface, #2a2a2a);
  padding: 32px;
  border: 2px solid #444;
  border-radius: 0;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.3);
}

@media (max-width: 360px) {
  .nonza-widget__reconnecting,
  .nonza-widget__connect {
    padding: 16px;
    align-items: flex-start;
    overflow-y: auto;
  }

  .nonza-widget__reconnecting-card,
  .nonza-widget__connect-form {
    padding: 20px;
  }
}

.nonza-widget__title {
  margin: 0 0 24px 0;
  font-size: 24px;
  font-weight: 400;
  font-family: "Bebas Neue", sans-serif;
  text-align: center;
  letter-spacing: 0.02em;
}

.nonza-widget__input-group {
  margin-bottom: 16px;
}

.nonza-widget__input-group--full .nonza-widget__input {
  width: 100%;
  box-sizing: border-box;
}

.nonza-widget__input-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #ccc;
}

.nonza-widget__password-form .nonza-widget__password-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #ccc;
}

.nonza-widget__password-form .nonza-widget__input {
  margin-bottom: 16px;
}

.nonza-widget__input-with-button {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.nonza-widget__input {
  flex: 1;
  padding: 8px;
  border: 2px solid #444;
  border-radius: 0;
  background: #1a1a1a;
  color: white;
  font-size: 16px;
  outline: none;
  transition: none;
  width: 100%;
}

.nonza-widget__input:focus {
  border-color: #2980b9;
  box-shadow: inset 0 0 0 2px #2980b9;
}

.nonza-widget__input--readonly {
  cursor: default;
  opacity: 0.9;
}

.nonza-widget__randomize-button {
  width: 44px;
  height: 44px;
  padding: 0;
  border: 2px solid #444;
  border-radius: 0;
  background: #1a1a1a;
  color: white;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: none;
  flex-shrink: 0;
}

.nonza-widget__randomize-button:hover {
  background: #2a2a2a;
  border-color: #2980b9;
}

.nonza-widget__randomize-button:active {
  background: #1a1a1a;
  box-shadow: inset 0 0 0 2px #2980b9;
}

.nonza-widget__form-button {
  width: 100%;
}

.HR {
  background-color: var(--mc-core-grey-4, #444);
  box-shadow: 0 -0.125rem #00000040;
  height: 0.125rem;
  width: 100%;
  margin-top: 1rem;
  margin-bottom: 1rem;
  border: none;
}

.nonza-widget__error {
  margin-top: 16px;
  padding: 12px;
  background: rgba(255, 190, 83, 0.2);
  border: 2px solid var(--color-accent);
  border-radius: 0;
  color: var(--color-accent);
  font-size: 14px;
  text-align: center;
}

.nonza-widget__room {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
