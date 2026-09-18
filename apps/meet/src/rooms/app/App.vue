<template>
  <div
    class="rooms-app padding-app full-page bg-darker"
    :class="{
      'rooms-app--scroll-root': isScrollRootPage,
      'rooms-app--drawer-open': sidebarDrawerOpen && isMainView,
      'rooms-app--with-titlebar': isTauriDesktop(),
      'rooms-app--in-room': Boolean(appStore.roomCode && isAuthed),
    }"
  >
    <header v-if="isTauriDesktop()" class="app-titlebar" data-tauri-drag-region>
      <span class="app-titlebar__title">Nonza</span>
    </header>
    <div v-if="appStore.showReconnectScreen" class="rooms-app__content">
      <ScreenLayout narrow>
        <div class="reconnect-screen__card">
          <PageHeader title="Ошибка соединения" />
          <p class="reconnect-screen__text">
            Не удалось связаться с сервером. Проверьте интернет и попробуйте
            снова.
          </p>
          <div class="reconnect-screen__actions">
            <Button
              type="text"
              variant="secondary"
              size="medium"
              @click="handleReconnect"
            >
              Переподключиться
            </Button>
          </div>
        </div>
      </ScreenLayout>
    </div>
    <div
      v-else-if="appStore.roomCode && isAuthed"
      class="rooms-app__room rooms-app__view"
    >
      <NonzaWidget
        :api-client="apiClient"
        :api-base-u-r-l="apiBaseURL"
        :livekit-u-r-l="livekitURL"
        :default-short-code="appStore.roomCode"
        connect-on-mount
        @disconnect="handleRoomDisconnect"
      />
      <!-- Временно скрыто: открытие звонка в отдельном окне
      <Button
        v-if="isTauriDesktop()"
        type="icon"
        size="small"
        class="rooms-app__open-in-new-window"
        title="Открыть звонок в отдельном окне"
        aria-label="Открыть звонок в отдельном окне"
        @click="openCallInNewWindow(appStore.roomCode!)"
      >
        <PixelIcon name="link" variant="large" />
      </Button>
      -->
    </div>
    <div
      v-else-if="appStore.page === 'oauth-authorize' && appStore.oauthAuthorizeParams"
      class="rooms-app__content rooms-app__content--auth-form"
    >
      <OAuthAuthorizeScreen
        :params="appStore.oauthAuthorizeParams!"
        @go-register="goToRegisterFromOAuth"
      />
    </div>
    <div
      v-else-if="appStore.page === 'login' && !isAuthed"
      class="rooms-app__content rooms-app__content--auth-form"
    >
      <LoginScreen
        @success="handleAuthSuccess"
        @go-register="appStore.setPage('register')"
      />
    </div>
    <div
      v-else-if="appStore.page === 'register' && !isAuthed"
      class="rooms-app__content rooms-app__content--auth-form"
    >
      <RegisterScreen
        @success="handleAuthSuccess"
        @go-login="appStore.setPage('login')"
      />
    </div>
    <div
      v-else-if="appStore.page === 'invite' && appStore.inviteToken"
      class="rooms-app__content"
    >
      <InviteScreen
        :token="appStore.inviteToken"
        @accepted="handleInviteAccepted"
        @openOrg="handleInviteOpenOrg"
        @cancel="goToOrganizations"
        @goLogin="goToLoginFromInvite"
      />
    </div>
    <div v-else-if="appStore.page === 'create-org'" class="rooms-app__content rooms-app__content--auth-form">
      <CreateOrganizationScreen
        @created="handleOrgCreated"
        @cancel="goToOrganizations"
      />
    </div>
    <div v-else-if="appStore.page === 'settings'" class="rooms-app__content rooms-app__content--auth-form">
      <SettingsScreen @back="goToOrganizations" @logout="handleLogout" />
    </div>
    <main v-else-if="isAuthed" class="container border-radius-app rooms-app__view">
      <div
        v-if="isMainView && sidebarDrawerOpen"
        class="rooms-app__drawer-overlay"
        aria-hidden="true"
        @click="closeSidebarDrawer"
      />
      <aside class="servers bg-dark-blur-90">
        <OrgPanel
          :organizations="organizations"
          :selected-id="selectedOrgId"
          @select="
            (org) => {
              closeSidebarDrawer();
              selectOrg(org);
            }
          "
          @create="
            () => {
              closeSidebarDrawer();
              appStore.setPage('create-org');
            }
          "
          @settings="
            () => {
              closeSidebarDrawer();
              if (selectedOrgId) showSettingsModal = true;
              else {
                appStore.setPage('settings');
                replaceState();
              }
            }
          "
          @go-home="
            () => {
              closeSidebarDrawer();
              handleOrgBack();
            }
          "
        />
      </aside>
      <Suspense v-if="selectedOrgId">
        <OrgScreen
          :api-client="apiClient"
          :org-id="selectedOrgId"
          class="container__org"
          @settings="handleGoSettings"
          @org-settings="handleOrgSettings"
          @back="handleOrgBack"
        />
        <template #fallback>
          <div class="container__org rooms-app__surface-boot" aria-busy="true">
            <div class="rooms-app__surface-boot-bar" />
            <div class="rooms-app__surface-boot-bar rooms-app__surface-boot-bar--short" />
            <div class="rooms-app__surface-boot-bar" />
          </div>
        </template>
      </Suspense>
      <div v-else class="vert-container vert-container--list">
        <OrganizationsListScreen
          :organizations="organizations"
          :loading="loading"
          @create="appStore.setPage('create-org')"
          @select="selectOrg"
        />
      </div>
      <Modal
        :model-value="showSettingsModal"
        fullscreen
        aria-label="Настройки"
        :close-on-overlay-click="false"
        @update:model-value="showSettingsModal = $event"
        @close="showSettingsModal = false"
      >
        <SettingsScreen
          @back="showSettingsModal = false"
          @logout="handleLogout"
        />
      </Modal>
      <Modal
        :model-value="!!(showOrgSettingsModal && selectedOrgId)"
        fullscreen
        aria-label="Настройки организации"
        :close-on-overlay-click="false"
        @update:model-value="onOrgSettingsModalUpdate"
        @close="showOrgSettingsModal = false"
      >
        <OrganizationSettingsScreen
          v-if="selectedOrgId"
          :org-id="selectedOrgId"
          @back="showOrgSettingsModal = false"
          @deleted="handleOrgDeleted"
          @open-soundbar="handleOpenOrgSoundbar"
        />
      </Modal>
      <Modal
        :model-value="!!(showOrgSoundbarModal && selectedOrgId)"
        fullscreen
        aria-label="Soundbar"
        :close-on-overlay-click="false"
        @update:model-value="showOrgSoundbarModal = $event"
        @close="showOrgSoundbarModal = false"
      >
        <OrganizationSoundbarScreen
          v-if="selectedOrgId"
          :org-id="selectedOrgId"
          :can-edit="orgSoundbarCanEdit"
          @back="showOrgSoundbarModal = false"
        />
      </Modal>
    </main>
    <div v-else class="rooms-app__content">
      <LoginScreen
        @success="handleAuthSuccess"
        @go-register="appStore.setPage('register')"
      />
    </div>
    <ToastContainer />
    <audio
      ref="ostAudioEl"
      :src="APP_OST_SRC"
      loop
      preload="auto"
      class="rooms-app__ost-audio"
    />
    <Teleport to="body">
      <Button
        v-if="shouldPlayOst"
        type="icon"
        size="tiny"
        variant="default"
        class="rooms-app__ost-mute"
        :title="ostMuted ? 'Включить музыку' : 'Выключить музыку'"
        :aria-label="ostMuted ? 'Включить музыку' : 'Выключить музыку'"
        @click="toggleOstMute"
      >
        <PixelIcon :name="ostIconName" variant="small" />
      </Button>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onMounted,
  onUnmounted,
  provide,
  defineAsyncComponent,
  useTemplateRef,
} from "vue";
import { storeToRefs } from "pinia";
import { OrganizationApi, parseOAuthAuthorizeParams, AuthApi } from "@shared/entities";
import { ApiClient } from "@shared/api";
import type { Organization } from "@shared/entities";
import {
  ScreenLayout,
  PageHeader,
  Button,
  PixelIcon,
  ToastContainer,
  Modal,
} from "@shared/ui";
import OrgPanel from "@rooms/widgets/org-panel/ui/OrgPanel.vue";
import NonzaWidget from "@app/NonzaWidget.vue";
import LoginScreen from "@rooms/widgets/login-screen/ui/LoginScreen.vue";
import RegisterScreen from "@rooms/widgets/register-screen/ui/RegisterScreen.vue";
import OrganizationsListScreen from "@rooms/widgets/organizations-list/ui/OrganizationsListScreen.vue";
import {
  getAuthHeaders,
  clearAuth,
  isAuthenticated,
  useIsAuthenticated,
  refreshAccessToken,
  startProactiveRefreshScheduler,
  setAuth,
  useMeetingShortcutListener,
  getApiBaseURL,
  getLivekitURL,
  API_BASE_URL_INJECT_KEY,
  LIVEKIT_URL_INJECT_KEY,
  // openCallInNewWindow, // временно скрыта кнопка "открыть в отдельном окне"
  isTauriDesktop,
  getStoredShortcuts,
  useAppOst,
  APP_OST_SRC,
  useAppUpdate,
  showToast,
} from "@shared/lib";
import { useAppStore, useOrganizationsStore } from "@rooms/app/stores";

const OAuthAuthorizeScreen = defineAsyncComponent(
  () =>
    import("@rooms/widgets/oauth-authorize-screen/ui/OAuthAuthorizeScreen.vue"),
);
const InviteScreen = defineAsyncComponent(
  () => import("@rooms/widgets/invite-screen/ui/InviteScreen.vue"),
);
const CreateOrganizationScreen = defineAsyncComponent(
  () =>
    import("@rooms/widgets/create-organization/ui/CreateOrganizationScreen.vue"),
);
const SettingsScreen = defineAsyncComponent(
  () => import("@rooms/widgets/settings-screen/ui/SettingsScreen.vue"),
);
const OrganizationSettingsScreen = defineAsyncComponent(
  () =>
    import("@rooms/widgets/org-settings-screen/ui/OrganizationSettingsScreen.vue"),
);
const OrganizationSoundbarScreen = defineAsyncComponent(
  () =>
    import("@rooms/widgets/org-soundbar-screen/ui/OrganizationSoundbarScreen.vue"),
);
const OrgScreen = defineAsyncComponent(
  () => import("@rooms/widgets/org-screen/ui/OrgScreen.vue"),
);

const apiBaseURL = getApiBaseURL();
const livekitURL = getLivekitURL();
const apiClient = new ApiClient({
  baseURL: apiBaseURL,
  getAuthHeaders,
  refreshAuth: () => refreshAccessToken(apiBaseURL),
  onBackendError() {
    appStore.setShowReconnectScreen(true);
  },
  onUnauthorized() {
    clearAuth();
    appStore.setRoomCode(null);
    appStore.setPage("login");
    appStore.clearInviteAndPending();
    orgStore.reset();
    replaceState();
  },
});
const organizationApi = new OrganizationApi(apiClient);

provide("apiClient", apiClient);
provide(API_BASE_URL_INJECT_KEY, apiBaseURL);
provide(LIVEKIT_URL_INJECT_KEY, livekitURL);
provide("openSidebarDrawer", () => {
  sidebarDrawerOpen.value = true;
});

const appStore = useAppStore();
const orgStore = useOrganizationsStore();
useMeetingShortcutListener();
const { organizations, loading, selectedOrgId } = storeToRefs(orgStore);
const isAuthed = useIsAuthenticated();

const sidebarDrawerOpen = ref(false);
const showSettingsModal = ref(false);
const showOrgSettingsModal = ref(false);
const showOrgSoundbarModal = ref(false);
const orgSoundbarCanEdit = ref(true);

const unlistenAppMenuLogout = ref<(() => void) | null>(null);

const shouldPlayOst = computed(() => {
  if (appStore.showReconnectScreen || appStore.roomCode) return false;
  if (appStore.page === "login" || appStore.page === "register") return true;
  if (appStore.page === "oauth-authorize") return false;
  if (isAuthed.value && appStore.page === "organizations") return true;
  if (
    !isAuthed.value &&
    appStore.page !== "invite" &&
    appStore.page !== "create-org" &&
    appStore.page !== "settings"
  ) {
    return true;
  }
  return false;
});

const ostAudioEl = useTemplateRef<HTMLAudioElement>("ostAudioEl");

const { muted: ostMuted, toggleMute: toggleOstMute } = useAppOst(
  shouldPlayOst,
  ostAudioEl,
);

const ostIconName = computed(() =>
  ostMuted.value ? "volume-off" : "volume-high",
);

const isMainView = computed(
  () =>
    isAuthed.value &&
    !appStore.showReconnectScreen &&
    !appStore.roomCode &&
    !["login", "register", "invite", "create-org", "settings", "oauth-authorize"].includes(
      appStore.page,
    ) &&
    true,
);

function closeSidebarDrawer() {
  sidebarDrawerOpen.value = false;
}

const isScrollRootPage = computed(
  () =>
    appStore.showReconnectScreen ||
    appStore.page === "login" ||
    appStore.page === "register" ||
    appStore.page === "invite" ||
    appStore.page === "oauth-authorize" ||
    appStore.page === "create-org" ||
    appStore.page === "settings" ||
    (!isAuthed.value && !appStore.roomCode),
);

function parseRoute() {
  const search = window.location.search;
  const oauthParams = parseOAuthAuthorizeParams(search);
  if (oauthParams) {
    appStore.setOAuthAuthorizeParams(oauthParams);
    appStore.setRoomCode(null);
    appStore.setPage("oauth-authorize");
    appStore.setInviteToken(null);
    orgStore.clearSelected();
    showSettingsModal.value = false;
    showOrgSettingsModal.value = false;
    showOrgSoundbarModal.value = false;
    return;
  }
  appStore.setOAuthAuthorizeParams(null);

  const params = new URLSearchParams(search);
  const code = params.get("code");
  appStore.setRoomCode(code || null);
  if (appStore.roomCode) {
    showSettingsModal.value = false;
    showOrgSettingsModal.value = false;
    showOrgSoundbarModal.value = false;
    return;
  }
  const p = params.get("page");
  const id = params.get("id");
  const token = params.get("token");
  showSettingsModal.value = false;
  showOrgSettingsModal.value = false;
  showOrgSoundbarModal.value = false;
  if (p === "login") {
    if (isAuthenticated()) {
      appStore.setPage("organizations");
      appStore.setInviteToken(null);
      orgStore.clearSelected();
      replaceState();
      loadOrganizations();
    } else {
      appStore.setPage("login");
      appStore.setInviteToken(null);
      orgStore.clearSelected();
    }
  } else if (p === "register") {
    if (isAuthenticated()) {
      appStore.setPage("organizations");
      appStore.setInviteToken(null);
      orgStore.clearSelected();
      replaceState();
      loadOrganizations();
    } else {
      appStore.setPage("register");
      appStore.setInviteToken(null);
      orgStore.clearSelected();
    }
  } else if (p === "invite" && token) {
    appStore.setPage("invite");
    appStore.setInviteToken(token);
    orgStore.clearSelected();
  } else if (p === "create-org") {
    appStore.setPage("create-org");
    appStore.setInviteToken(null);
    orgStore.clearSelected();
  } else if (p === "settings") {
    appStore.setPage("settings");
    appStore.setInviteToken(null);
    orgStore.clearSelected();
  } else if (p === "org-settings" && id) {
    appStore.setPage("org");
    appStore.setInviteToken(null);
    orgStore.setSelectedId(id);
    showOrgSettingsModal.value = true;
  } else if (p === "org" && id) {
    appStore.setPage("org");
    appStore.setInviteToken(null);
    orgStore.setSelectedId(id);
  } else {
    appStore.setPage("organizations");
    appStore.setInviteToken(null);
    if (id) orgStore.setSelectedId(id);
    else orgStore.clearSelected();
  }
}

function replaceState() {
  if (appStore.roomCode) {
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?code=${encodeURIComponent(appStore.roomCode)}`,
    );
    return;
  }
  let query = "";
  if (appStore.page === "oauth-authorize" && appStore.oauthAuthorizeParams) {
    const p = appStore.oauthAuthorizeParams;
    const q = new URLSearchParams({
      page: "oauth-authorize",
      client_id: p.clientId,
      redirect_uri: p.redirectUri,
      state: p.state,
    });
    if (p.scope) {
      q.set("scope", p.scope);
    }
    if (p.codeChallenge) {
      q.set("code_challenge", p.codeChallenge);
      q.set("code_challenge_method", p.codeChallengeMethod || "S256");
    }
    query = `?${q.toString()}`;
  } else if (appStore.page === "login") {
    query = "?page=login";
  } else if (appStore.page === "register") {
    query = "?page=register";
  } else if (appStore.page === "invite" && appStore.inviteToken) {
    query = `?page=invite&token=${encodeURIComponent(appStore.inviteToken)}`;
  } else if (appStore.page === "create-org") {
    query = "?page=create-org";
  } else if (appStore.page === "settings") {
    query = "?page=settings";
  } else if (appStore.page === "org" && orgStore.selectedOrgId) {
    query = `?page=org&id=${orgStore.selectedOrgId}`;
  } else if (orgStore.selectedOrgId) {
    query = `?page=organizations&id=${orgStore.selectedOrgId}`;
  } else {
    query = "?page=organizations";
  }
  window.history.replaceState(null, "", `${window.location.pathname}${query}`);
}

function goToRegisterFromOAuth() {
  appStore.setPage("register");
  replaceState();
}

function goToOrganizations() {
  appStore.setPage("organizations");
  replaceState();
  loadOrganizations();
}

function handleOrgBack() {
  orgStore.clearSelected();
  goToOrganizations();
}

function goToLoginFromInvite() {
  if (appStore.inviteToken)
    appStore.setPendingInviteAfterLogin(appStore.inviteToken);
  appStore.setPage("login");
  replaceState();
}

function selectOrg(org: Organization) {
  orgStore.setSelectedId(org.id);
  appStore.setPage("org");
  replaceState();
}

function handleOrgCreated(org: Organization) {
  orgStore.addOrganization(org);
  orgStore.setSelectedId(org.id);
  appStore.setPage("org");
  replaceState();
}

function handleInviteAccepted(orgId: string) {
  orgStore.setSelectedId(orgId);
  appStore.setPage("org");
  appStore.setInviteToken(null);
  replaceState();
  organizationApi
    .getById(orgId)
    .then((org) => orgStore.addOrganization(org))
    .catch(() => {});
  loadOrganizations();
}

function handleInviteOpenOrg(orgId: string) {
  handleInviteAccepted(orgId);
}

function handleAuthSuccess() {
  if (appStore.page === "oauth-authorize" || appStore.oauthAuthorizeParams) {
    if (appStore.oauthAuthorizeParams) {
      appStore.setPage("oauth-authorize");
      replaceState();
    }
    return;
  }
  if (appStore.pendingInviteAfterLogin) {
    appStore.setInviteToken(appStore.pendingInviteAfterLogin);
    appStore.setPendingInviteAfterLogin(null);
    appStore.setPage("invite");
    replaceState();
    return;
  }
  appStore.setPage("organizations");
  replaceState();
  loadOrganizations();
  syncAppMenu();
}

function handleLogout() {
  clearAuth();
  appStore.setRoomCode(null);
  appStore.setPage("login");
  appStore.clearInviteAndPending();
  orgStore.reset();
  replaceState();
  syncAppMenu();
}

function handleGoSettings() {
  showSettingsModal.value = true;
}

function handleOrgSettings() {
  showOrgSettingsModal.value = true;
}

function onOrgSettingsModalUpdate(v: boolean) {
  showOrgSettingsModal.value = v;
  if (!v) {
    showOrgSoundbarModal.value = false;
  }
}

function handleOpenOrgSoundbar(payload: { canEdit: boolean }) {
  orgSoundbarCanEdit.value = payload.canEdit;
  showOrgSoundbarModal.value = true;
}

function handleOrgDeleted() {
  showOrgSettingsModal.value = false;
  showOrgSoundbarModal.value = false;
  orgStore.clearSelected();
  appStore.setPage("organizations");
  replaceState();
  orgStore.loadOrganizations(organizationApi);
}

function handleRoomDisconnect() {
  appStore.setRoomCode(null);
  appStore.setPage("organizations");
  replaceState();
  loadOrganizations();
}

function handleReconnect() {
  appStore.setShowReconnectScreen(false);
  if (
    appStore.page === "organizations" ||
    (appStore.page === "org" && orgStore.selectedOrgId)
  ) {
    orgStore.loadOrganizations(organizationApi);
  }
}

function syncAppMenu() {
  if (!isTauriDesktop()) return;
  const shortcuts = getStoredShortcuts();
  import("@tauri-apps/api/core")
    .then(({ invoke }) =>
      Promise.all([
        invoke("set_shortcut_bindings", {
          audio: shortcuts.audio,
          video: shortcuts.video,
          leave: shortcuts.leave,
          sound: shortcuts.sound,
        }),
        invoke("update_app_menu", {
          logoutVisible: isAuthenticated(),
          audioShortcut: shortcuts.audio,
          videoShortcut: shortcuts.video,
          leaveShortcut: shortcuts.leave,
          soundShortcut: shortcuts.sound,
        }),
      ]),
    )
    .catch((err) =>
      console.error(
        "[syncAppMenu] set_shortcut_bindings / update_app_menu failed:",
        err,
      ),
    );
}

watch(
  [
    () => appStore.page,
    () => appStore.inviteToken,
    () => appStore.roomCode,
    () => orgStore.selectedOrgId,
  ],
  replaceState,
);

watch(isAuthed, () => {
  if (isTauriDesktop()) syncAppMenu();
});

function loadOrganizations() {
  orgStore.loadOrganizations(organizationApi);
}

async function completeSocialLoginFromQuery(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const ticket = params.get("social_ticket")?.trim();
  if (!ticket) return false;
  try {
    const authApi = new AuthApi(new ApiClient({ baseURL: apiBaseURL }));
    const res = await authApi.exchangeSocialTicket(ticket);
    setAuth(
      res.access_token,
      res.expires_at,
      {
        id: res.user.id,
        email: res.user.email,
        name: res.user.name,
        color: res.user.color,
      },
      res.refresh_token,
      res.refresh_expires_at,
    );
    params.delete("social_ticket");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}`,
    );
    return true;
  } catch {
    params.delete("social_ticket");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}`,
    );
    return false;
  }
}

async function checkDesktopUpdateOnStartup() {
  const { loadVersion, check, update } = useAppUpdate();
  await loadVersion();
  await check();
  if (update.value) {
    showToast(
      `Доступно обновление ${update.value.version}. Настройки → Приложение.`,
      { variant: "info", duration: 10000 },
    );
  }
}

onMounted(async () => {
  window.addEventListener("keydown", onKeydown);
  if (isTauriDesktop()) {
    document.documentElement.classList.add("nonza-desktop");
    syncAppMenu();
    void checkDesktopUpdateOnStartup();
  }
  const socialLoggedIn = await completeSocialLoginFromQuery();
  startProactiveRefreshScheduler(apiBaseURL);
  if (socialLoggedIn) {
    appStore.setRoomCode(null);
    appStore.setInviteToken(null);
    orgStore.clearSelected();
    appStore.setPage("organizations");
    replaceState();
    loadOrganizations();
  } else {
    parseRoute();
    const publicPages = ["login", "register", "invite", "oauth-authorize"];
    if (!isAuthenticated() && !publicPages.includes(appStore.page)) {
      appStore.setRoomCode(null);
      appStore.setPage("login");
      replaceState();
    } else if (
      isAuthenticated() &&
      (appStore.page === "login" || appStore.page === "register")
    ) {
      appStore.setPage("organizations");
      appStore.setInviteToken(null);
      orgStore.clearSelected();
      replaceState();
      loadOrganizations();
    } else if (
      !isAuthenticated() &&
      appStore.page === "invite" &&
      !appStore.inviteToken
    ) {
      appStore.setPage("login");
      replaceState();
    } else if (
      appStore.page === "organizations" ||
      (appStore.page === "org" && orgStore.selectedOrgId)
    ) {
      loadOrganizations();
    }
  }
  if (isTauriDesktop()) {
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("app-menu-logout", () => {
        handleLogout();
      }).then((fn) => {
        unlistenAppMenuLogout.value = fn;
      });
    });
  }
});

window.addEventListener("popstate", parseRoute);

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    if (showOrgSoundbarModal.value) showOrgSoundbarModal.value = false;
    else if (showOrgSettingsModal.value) showOrgSettingsModal.value = false;
    else if (showSettingsModal.value) showSettingsModal.value = false;
    else if (sidebarDrawerOpen.value) sidebarDrawerOpen.value = false;
  }
}

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  unlistenAppMenuLogout.value?.();
});
</script>

<style scoped>
.rooms-app {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 100dvh;
  min-height: 100vh;
  align-items: stretch;
  justify-content: flex-start;
  transition: padding 0.2s ease;
}

.rooms-app--in-room {
  padding: 0 !important;
}

.rooms-app__view {
  animation: rooms-soft-in 0.22s ease both;
}

.rooms-app__surface-boot {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px 20px;
  background: #14141490;
}

.rooms-app__surface-boot-bar {
  height: 56px;
  border: 3px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04),
    rgba(255, 255, 255, 0.1),
    rgba(255, 255, 255, 0.04)
  );
  background-size: 200% 100%;
  animation: rooms-shimmer 1.1s linear infinite;
}

.rooms-app__surface-boot-bar--short {
  width: 62%;
  height: 40px;
}

@keyframes rooms-soft-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes rooms-shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

.rooms-app--scroll-root {
  height: 100dvh;
  height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
}

.rooms-app--scroll-root .rooms-app__content {
  flex: none;
  overflow: visible;
  min-height: 0;
}

.rooms-app__content--auth-form {
  padding: 0;
  width: 100%;
  max-width: none;
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: stretch;
  min-height: min-content;
}

.rooms-app__content--auth-form > * {
  width: 100%;
}

.rooms-app__main {
  flex: 1;
  min-height: 0;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
}

.rooms-app__content {
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
  flex: 1;
  min-height: 0;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  position: relative;
  z-index: 10000;
}

@media (max-width: 768px) {
  .rooms-app__content--auth-form {
    justify-content: flex-start;
    flex: none;
  }

  .rooms-app__content {
    padding: 16px 12px;
    overflow: visible;
  }

  .rooms-app--scroll-root .rooms-app__content {
    padding-bottom: max(20px, env(safe-area-inset-bottom, 0px));
  }
}

@media (max-width: 360px) {
  .rooms-app__content {
    padding: 12px;
  }
}

.rooms-app__room {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}

.rooms-app__open-in-new-window {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  opacity: 0.7;
}

.rooms-app__open-in-new-window:hover {
  opacity: 1;
}

.rooms-app__ost-audio {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.rooms-app__ost-mute {
  position: fixed;
  bottom: 16px;
  right: 12px;
  z-index: 10020;
  pointer-events: auto;
  opacity: 0.4;
}

.rooms-app__ost-mute:hover {
  opacity: 1;
  color: var(--color-text, #fff);
  background: rgba(255, 255, 255, 0.15);
}

.rooms-app__ost-mute:hover:not(.button--disabled) {
  scale: 1;
}

.rooms-app__ost-mute :deep(.pi) {
  --pi-size: 16px;
  width: 16px;
  height: 16px;
}

.container {
  display: flex;
  flex: 1;
  min-height: 0;
  min-width: 0;
  background: transparent;
}

.container__org {
  flex: 1;
  min-width: 0;
  display: flex;
  min-height: 0;
}

.servers {
  flex: 0 0 72px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--color-background);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.servers::-webkit-scrollbar {
  display: none;
}

.rooms-app__drawer-overlay {
  display: none;
}

@media (max-width: 480px) {
  .rooms-app__drawer-overlay {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 10001;
    background: rgba(0, 0, 0, 0.5);
    cursor: pointer;
  }

  .servers {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 72px;
    flex: none;
    z-index: 10002;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    padding-top: env(safe-area-inset-top, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  .rooms-app--drawer-open .servers {
    transform: translateX(0);
    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.3);
  }

  .container__org,
  .vert-container--list {
    min-width: 0;
  }

  .vert-container--list {
    padding: 16px 12px max(24px, env(safe-area-inset-bottom, 0px));
  }
}

@media (max-width: 360px) {
  .vert-container--list {
    padding: 12px;
  }
}

.vert-container {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-background);
}

.vert-container--list {
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  padding: 28px 32px 40px;
  background: #14141490;
  backdrop-filter: blur(2.5px);
}

.reconnect-screen__card {
  background: #2a2a2a;
  border: 2px solid #444;
  padding: 24px;
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.3);
}

.reconnect-screen__text {
  color: #bab1a8;
  margin: 0 0 20px;
  line-height: 1.5;
}

.reconnect-screen__actions {
  padding-top: 16px;
  border-top: 2px solid #444;
}
</style>
