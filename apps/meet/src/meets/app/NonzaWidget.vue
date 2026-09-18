<template>
  <div class="nonza-widget" :class="{ 'nonza-widget--connected': isConnected }">
    <div v-if="isReconnecting" class="nonza-widget__reconnecting">
      <div class="meets-entry meets-entry--status">
        <header class="meets-entry__header">
          <h1 class="meets-entry__heading">Nonza</h1>
        </header>
        <MetroTile
          size="wide"
          variant="gold"
          mark="…"
          class="meets-entry__tile meets-entry__status"
        >
          <template #title>Переподключение</template>
          <p class="meets-entry__lead">
            Соединение с комнатой было потеряно.
          </p>
          <Button
            type="text"
            variant="accent"
            size="large"
            :disabled="isConnecting"
            class="meets-entry__cta"
            @click="handleReconnect"
          >
            {{ isConnecting ? "Подключение..." : "Переподключиться" }}
          </Button>
          <div v-if="connectionState.error" class="nonza-widget__error">
            {{ connectionState.error }}
          </div>
        </MetroTile>
      </div>
    </div>
    <div v-else-if="!isConnected" class="nonza-widget__connect">
      <template v-if="entryMode === 'by_selection'">
        <div v-if="!passwordRequired" class="meets-entry meets-entry--status">
          <header class="meets-entry__header">
            <h1 class="meets-entry__heading">Nonza</h1>
          </header>
          <MetroTile
            size="wide"
            variant="blue"
            mark="…"
            class="meets-entry__tile meets-entry__status"
          >
            <template #title>
              {{ isConnecting ? "Подключение" : "Подготовка" }}
            </template>
            <p class="meets-entry__lead">Сейчас зайдём в комнату.</p>
          </MetroTile>
        </div>
      </template>
      <template v-else>
        <div v-if="isRoomNotFound" class="meets-entry meets-entry--not-found">
          <header class="meets-entry__header">
            <h1 class="meets-entry__heading">Nonza</h1>
          </header>

          <div class="meets-entry__not-found-grid">
            <MetroTile
              size="wide"
              variant="red"
              mark="?"
              class="meets-entry__tile meets-entry__not-found-main"
            >
              <template #title>Комната не найдена</template>
              <p class="meets-entry__lead">
                Проверьте код или вернитесь и попробуйте снова.
              </p>
            </MetroTile>

            <MetroTile
              v-if="defaultShortCode"
              size="wide"
              variant="blue"
              mark="←"
              clickable
              class="meets-entry__tile meets-entry__not-found-back"
              @click="handleRoomNotFoundBack"
            >
              <template #title>К организациям</template>
              <p class="meets-entry__lead">Список ваших орг.</p>
              <span class="meets-entry__foot">назад →</span>
            </MetroTile>

            <MetroTile
              v-else
              size="wide"
              variant="blue"
              mark="←"
              clickable
              class="meets-entry__tile meets-entry__not-found-back"
              @click="handleTryAnotherCode"
            >
              <template #title>Другой код</template>
              <p class="meets-entry__lead">Ввести код комнаты заново.</p>
              <span class="meets-entry__foot">ввод →</span>
            </MetroTile>

            <MetroTile
              size="wide"
              variant="purple"
              clickable
              class="meets-entry__tile meets-entry__not-found-create"
              @click="handleCreateRoom"
            >
              <template #title>Создать комнату</template>
              <template #media>
                <PixelIcon name="people" variant="large" />
              </template>
              <p class="meets-entry__lead">Новая встреча с вашим кодом.</p>
            </MetroTile>
          </div>
        </div>
        <div v-else-if="isConnecting && !error" class="meets-entry meets-entry--status">
          <header class="meets-entry__header">
            <h1 class="meets-entry__heading">Nonza</h1>
          </header>
          <MetroTile
            size="wide"
            variant="blue"
            mark="…"
            class="meets-entry__tile meets-entry__status"
          >
            <template #title>Подключение</template>
            <p class="meets-entry__lead">Заходим в комнату.</p>
          </MetroTile>
        </div>
        <form
          v-else
          class="meets-entry"
          autocomplete="on"
          @submit.prevent="handleConnect"
        >
          <header class="meets-entry__header">
            <h1 class="meets-entry__heading">Nonza</h1>
          </header>

          <div class="meets-entry__grid">
            <MetroTile
              size="wide"
              variant="dark"
              mark="@"
              class="meets-entry__tile meets-entry__nick"
            >
              <template #title>Ваш ник</template>
              <div class="meets-entry__fields">
                <label
                  v-if="!isAuthParticipant"
                  class="meets-entry__label"
                  for="participantName"
                >
                  Имя в звонке
                  <div class="meets-entry__nick-row">
                    <input
                      id="participantName"
                      v-model="participantName"
                      type="text"
                      placeholder="Введите ваше имя"
                      class="meets-entry__input"
                      autocomplete="nickname"
                    />
                    <Button
                      type="icon"
                      size="medium"
                      class="meets-entry__randomize"
                      title="Сгенерировать случайное имя"
                      aria-label="Сгенерировать случайное имя"
                      @click="handleRandomizeName"
                    >
                      <PixelIcon name="reload" variant="large" />
                    </Button>
                  </div>
                </label>
                <label
                  v-else
                  class="meets-entry__label"
                  for="participantName"
                >
                  Участник
                  <input
                    id="participantName"
                    :value="displayParticipantName"
                    type="text"
                    readonly
                    class="meets-entry__input meets-entry__input--readonly"
                  />
                </label>
                <div class="meets-entry__media">
                  <span class="meets-entry__media-label">Проверка устройств</span>
                  <MediaCheck ref="mediaCheckRef" />
                </div>
              </div>
            </MetroTile>

            <MetroTile
              size="wide"
              variant="blue"
              mark="→"
              class="meets-entry__tile meets-entry__join"
            >
              <template #title>Войти по коду</template>
              <p class="meets-entry__lead">Код комнаты — и сразу внутрь.</p>
              <div class="meets-entry__fields">
                <label class="meets-entry__label" for="shortCode">
                  Код комнаты
                  <input
                    id="shortCode"
                    v-model="shortCode"
                    type="text"
                    placeholder="abc-defg-hij"
                    class="meets-entry__input"
                    autocomplete="off"
                  />
                </label>
                <label
                  v-if="showPasswordField"
                  class="meets-entry__label"
                  for="roomPassword"
                >
                  Пароль комнаты
                  <input
                    id="roomPassword"
                    v-model="roomPassword"
                    type="password"
                    placeholder="Введите пароль"
                    class="meets-entry__input"
                    autocomplete="current-password"
                  />
                </label>
                <Button
                  type="text"
                  native-type="submit"
                  variant="primary"
                  size="large"
                  :disabled="!canConnect || isConnecting"
                  class="meets-entry__cta"
                >
                  {{ isConnecting ? "Подключение..." : "Войти" }}
                </Button>
              </div>
            </MetroTile>

            <MetroTile
              size="wide"
              variant="purple"
              mark="+"
              clickable
              class="meets-entry__tile meets-entry__create"
              @click="handleCreateRoom"
            >
              <template #title>Создать комнату</template>
              <template #media>
                <PixelIcon name="people" variant="large" />
              </template>
              <p class="meets-entry__lead">Новая встреча с вашим кодом.</p>
              <span class="meets-entry__foot">создать →</span>
            </MetroTile>
          </div>

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
        :show-document="displayRoomType != null"
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
import { Button, PixelIcon, Modal, MetroTile, MediaCheck } from "@shared/ui";
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
const mediaCheckRef = ref<InstanceType<typeof MediaCheck> | null>(null);
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
  mediaCheckRef.value?.stopAll?.();
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

.nonza-widget:not(.nonza-widget--connected) {
  background: #14141490;
  backdrop-filter: blur(2.5px);
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
  padding: 20px 16px max(28px, env(safe-area-inset-bottom, 0px));
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
  padding-top: max(20px, env(safe-area-inset-top, 0px));
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  box-sizing: border-box;
}

.meets-entry {
  width: min(920px, 100%);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.meets-entry__header {
  margin-bottom: 2px;
}

.meets-entry__heading {
  margin: 0;
  font-family: "Bebas Neue", sans-serif;
  font-weight: normal;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: clamp(2.2rem, 5vw, 3.2rem);
  line-height: 0.92;
  color: #81b538;
}

.meets-entry__grid {
  display: grid;
  grid-template-columns: 1fr 1.25fr;
  grid-template-areas:
    "nick join"
    "nick create";
  gap: 12px;
  align-items: stretch;
}

.meets-entry__nick {
  grid-area: nick;
}

.meets-entry__join {
  grid-area: join;
}

.meets-entry__create {
  grid-area: create;
}

.meets-entry__tile {
  width: 100% !important;
  height: auto !important;
  min-height: 0 !important;
}

.meets-entry__tile :deep(.metro-tile__inner) {
  gap: 10px;
  padding: 18px;
  height: 100%;
  box-sizing: border-box;
}

.meets-entry__tile :deep(.metro-tile__title) {
  max-width: 100%;
  margin-top: 0;
  font-size: clamp(1.7rem, 3.2vw, 2.35rem);
}

.meets-entry__tile :deep(.metro-tile__mark) {
  right: 4px;
  bottom: 2px;
  font-size: clamp(3.2rem, 7vw, 4.6rem);
  color: rgba(255, 255, 255, 0.08);
  z-index: 0;
  max-width: 55%;
  max-height: 70%;
  overflow: hidden;
}

.meets-entry__tile :deep(.metro-tile__body) {
  position: relative;
  z-index: 1;
  margin-top: 4px;
  gap: 12px;
  width: 100%;
  max-width: 100%;
  flex: 1;
}

.meets-entry__status {
  width: 100% !important;
  max-width: 100%;
  min-height: 0 !important;
  height: auto !important;
  align-self: stretch;
  box-sizing: border-box;
}

.meets-entry__status :deep(.metro-tile__inner) {
  gap: 10px;
  padding: 18px 16px 16px;
  justify-content: flex-start;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

.meets-entry__status :deep(.metro-tile__title) {
  font-size: clamp(1.7rem, 4.5vw, 2.35rem);
  max-width: 100%;
  width: 100%;
  line-height: 0.95;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  -webkit-line-clamp: 2;
}

.meets-entry__status :deep(.metro-tile__mark) {
  font-size: clamp(2.8rem, 9vw, 4rem);
  max-width: 36%;
  max-height: 65%;
  overflow: hidden;
  right: 4px;
  bottom: 2px;
  top: auto;
  color: rgba(255, 255, 255, 0.1);
}

.meets-entry__status :deep(.metro-tile__body) {
  gap: 12px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  flex: 0 0 auto;
}

.meets-entry__status .meets-entry__lead {
  max-width: 100%;
}

.meets-entry__status .meets-entry__cta {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.meets-entry__status .nonza-widget__error {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  margin-top: 0;
  word-break: break-word;
}

.meets-entry--status {
  width: min(520px, 100%);
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  box-sizing: border-box;
}

.meets-entry__nick {
  min-height: 100%;
}

.meets-entry__join,
.meets-entry__create {
  min-height: 168px;
}

.meets-entry__not-found-grid {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  grid-template-areas:
    "main main"
    "back create";
  gap: 12px;
  align-items: stretch;
}

.meets-entry__not-found-main {
  grid-area: main;
  min-height: 168px;
}

.meets-entry__not-found-back {
  grid-area: back;
  min-height: 148px;
}

.meets-entry__not-found-create {
  grid-area: create;
  min-height: 148px;
}

.meets-entry__lead {
  margin: 0;
  max-width: 100%;
  font-size: 0.92rem;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.82);
}

.meets-entry__foot {
  position: relative;
  z-index: 1;
  margin-top: auto;
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 8px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.75;
  max-width: 100%;
}

.meets-entry__fields {
  display: grid;
  gap: 12px;
  width: 100%;
}

.meets-entry__media {
  display: grid;
  gap: 0.4rem;
  width: 100%;
  margin-top: 2px;
}

.meets-entry__media-label {
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 8px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.85);
}

.meets-entry__label {
  display: grid;
  gap: 0.4rem;
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 8px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.85);
  min-width: 0;
}

.meets-entry__input {
  width: 100%;
  height: 52px;
  min-height: 52px;
  padding: 12px 14px;
  border: 3px solid rgba(255, 255, 255, 0.14);
  border-radius: 0;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(0, 0, 0, 0.28);
  color: #fff;
  font-size: 13px;
  font-family: "Press Start 2P", ui-monospace, monospace;
  letter-spacing: 0.02em;
  line-height: 1.4;
  outline: none;
  box-sizing: border-box;
}

.meets-entry__input::placeholder {
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.45);
}

.meets-entry__input:hover {
  background: rgba(0, 0, 0, 0.36);
}

.meets-entry__input:focus {
  background: rgba(0, 0, 0, 0.42);
  outline: 3px solid #fff;
  outline-offset: 2px;
}

.meets-entry__input--readonly {
  cursor: default;
  opacity: 0.9;
}

.meets-entry__nick-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.meets-entry__nick-row .meets-entry__input {
  flex: 1;
  min-width: 0;
}

.meets-entry__randomize {
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  background: #3a3a3a !important;
  border-color: #555 !important;
  color: #9a9a9a !important;
  opacity: 0.85;
  filter: grayscale(1);
}

.meets-entry__randomize:hover {
  background: #454545 !important;
  border-color: #666 !important;
  color: #c0c0c0 !important;
  opacity: 1;
}

.meets-entry__cta {
  width: 100%;
  min-height: 52px;
  justify-content: center;
  font-family: "Bebas Neue", sans-serif !important;
  font-size: 1.45rem !important;
  font-weight: normal !important;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1;
  padding: 14px 22px !important;
}

.nonza-widget__form-button {
  width: 100%;
}

.nonza-widget__title {
  margin: 0 0 24px 0;
  font-size: 24px;
  font-weight: 400;
  font-family: "Bebas Neue", sans-serif;
  text-align: center;
  letter-spacing: 0.02em;
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

.nonza-widget__input {
  flex: 1;
  padding: 8px;
  border: 2px solid #444;
  border-radius: 0;
  -webkit-appearance: none;
  appearance: none;
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

.nonza-widget__error {
  margin-top: 4px;
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

@media (max-width: 720px) {
  .nonza-widget__reconnecting,
  .nonza-widget__connect {
    align-items: stretch;
    justify-content: flex-start;
    padding: 12px 10px max(16px, env(safe-area-inset-bottom, 0));
    overflow-y: auto;
  }

  .nonza-widget__reconnecting,
  .nonza-widget__connect:has(.meets-entry--status) {
    align-items: center;
    justify-content: center;
    min-height: 100%;
  }

  .meets-entry--status {
    width: min(520px, 100%);
  }

  .meets-entry {
    width: 100%;
    gap: 10px;
    min-height: 0;
  }

  .meets-entry__heading {
    font-size: clamp(1.9rem, 9vw, 2.4rem);
  }

  .meets-entry__grid {
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      "nick nick"
      "join create";
    gap: 10px;
    align-items: stretch;
  }

  .meets-entry__not-found-grid {
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      "main main"
      "back create";
    gap: 10px;
  }

  .meets-entry__join,
  .meets-entry__create,
  .meets-entry__nick,
  .meets-entry__not-found-main,
  .meets-entry__not-found-back,
  .meets-entry__not-found-create {
    min-height: 0;
  }

  .meets-entry__create :deep(.metro-tile__inner) {
    justify-content: space-between;
  }

  .meets-entry__create :deep(.metro-tile__media) {
    display: none;
  }

  .meets-entry__create {
    min-height: 100%;
  }

  .meets-entry__tile :deep(.metro-tile__inner) {
    padding: 14px 12px 12px !important;
    gap: 8px;
  }

  .meets-entry__tile.metro-tile--has-mark :deep(.metro-tile__inner) {
    padding-right: 12px !important;
  }

  .meets-entry__tile :deep(.metro-tile__title) {
    font-size: clamp(1.45rem, 6.5vw, 1.85rem);
  }

  .meets-entry__create :deep(.metro-tile__title) {
    font-size: clamp(1.25rem, 5.2vw, 1.55rem);
  }

  .meets-entry__tile :deep(.metro-tile__body) {
    gap: 8px;
    margin-top: 2px;
  }

  .meets-entry__fields {
    gap: 8px;
  }

  .meets-entry__lead {
    font-size: 0.82rem;
    line-height: 1.3;
  }

  .meets-entry__input,
  .meets-entry__randomize {
    height: 44px;
    min-height: 44px;
  }

  .meets-entry__randomize {
    width: 44px;
  }

  .meets-entry__input {
    padding: 10px 12px;
    font-size: 12px;
  }

  .meets-entry__input::placeholder {
    font-size: 10px;
  }

  .meets-entry__cta {
    min-height: 44px;
    font-size: 1.25rem !important;
    padding: 10px 16px !important;
  }

  .meets-entry__join .meets-entry__lead {
    display: none;
  }

  .meets-entry__status {
    width: 100% !important;
  }

  .meets-entry__status :deep(.metro-tile__title) {
    font-size: clamp(1.45rem, 6.5vw, 1.85rem);
  }

  .meets-entry__status :deep(.metro-tile__mark) {
    font-size: clamp(2.2rem, 12vw, 3.2rem);
  }

  .meets-entry--status {
    width: 100%;
  }
}

@media (max-width: 360px) {
  .nonza-widget__reconnecting,
  .nonza-widget__connect {
    padding: 10px 8px max(12px, env(safe-area-inset-bottom, 0));
  }

  .meets-entry__grid {
    grid-template-columns: 1fr;
    grid-template-areas:
      "nick"
      "join"
      "create";
  }

  .meets-entry__create .meets-entry__lead {
    display: block;
  }
}

@media (max-height: 760px) and (min-width: 721px) {
  .meets-entry__join,
  .meets-entry__create {
    min-height: 140px;
  }

  .meets-entry__tile :deep(.metro-tile__inner) {
    padding: 14px 16px 12px;
  }
}
</style>
