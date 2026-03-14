<template>
  <div
    class="rooms-app padding-app full-page bg-dark grain-overlay"
    :class="{ 'rooms-app--scroll-root': isScrollRootPage }"
  >
    <div v-if="appStore.showReconnectScreen" class="rooms-app__content">
      <ScreenLayout narrow>
        <div class="reconnect-screen__card">
          <PageHeader title="Ошибка соединения" />
          <p class="reconnect-screen__text">
            Не удалось связаться с сервером. Проверьте интернет и попробуйте снова.
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
    <div v-else-if="appStore.roomCode && isAuthenticated()" class="rooms-app__room">
      <NonzaWidget
        :api-client="apiClient"
        :api-base-u-r-l="apiBaseURL"
        :livekit-u-r-l="livekitURL"
        :default-short-code="appStore.roomCode"
        connect-on-mount
        @disconnect="handleRoomDisconnect"
      />
    </div>
    <div v-else-if="appStore.page === 'login'" class="rooms-app__content">
      <LoginScreen
        @success="handleAuthSuccess"
        @go-register="appStore.setPage('register')"
      />
    </div>
    <div v-else-if="appStore.page === 'register'" class="rooms-app__content">
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
        @cancel="goToOrganizations"
        @goLogin="goToLoginFromInvite"
      />
    </div>
    <div v-else-if="appStore.page === 'create-org'" class="rooms-app__content">
      <CreateOrganizationScreen
        @created="handleOrgCreated"
        @cancel="goToOrganizations"
      />
    </div>
    <div v-else-if="appStore.page === 'settings'" class="rooms-app__content">
      <SettingsScreen @back="goToOrganizations" @logout="handleLogout" />
    </div>
    <div
      v-else-if="appStore.page === 'org-settings' && selectedOrgId"
      class="rooms-app__content"
    >
      <OrganizationSettingsScreen
        :org-id="selectedOrgId"
        @back="handleOrgSettingsBack"
        @deleted="handleOrgDeleted"
      />
    </div>
    <main v-else-if="isAuthenticated()" class="container border-radius-app">
      <aside class="servers bg-dark-blur-90">
        <OrgPanel
          :organizations="organizations"
          :selected-id="selectedOrgId"
          @select="selectOrg"
          @create="appStore.setPage('create-org')"
          @settings="appStore.setPage('settings')"
          @go-home="handleOrgBack"
        />
      </aside>
      <OrgScreen
        v-if="selectedOrgId"
        :api-client="apiClient"
        :org-id="selectedOrgId"
        class="container__org"
        @settings="handleGoSettings"
        @org-settings="handleOrgSettings"
        @back="handleOrgBack"
      />
      <div v-else class="vert-container vert-container--list">
        <OrganizationsListScreen
          :organizations="organizations"
          :loading="loading"
          @create="appStore.setPage('create-org')"
          @select="selectOrg"
        />
      </div>
    </main>
    <div v-else class="rooms-app__content">
      <LoginScreen
        @success="handleAuthSuccess"
        @go-register="appStore.setPage('register')"
      />
    </div>
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, provide, defineAsyncComponent } from "vue";
import { storeToRefs } from "pinia";
import { OrganizationApi } from "@shared/entities";
import { ApiClient } from "@shared/api";
import type { Organization } from "@shared/entities";
import { ScreenLayout, PageHeader, Button, ToastContainer } from "@shared/ui";
import OrgPanel from "@rooms/widgets/org-panel/ui/OrgPanel.vue";
import NonzaWidget from "@app/NonzaWidget.vue";
import {
  getAuthHeaders,
  clearAuth,
  isAuthenticated,
  refreshAccessToken,
  useMeetingShortcutListener,
  getApiBaseURL,
  getLivekitURL,
  API_BASE_URL_INJECT_KEY,
  LIVEKIT_URL_INJECT_KEY,
} from "@shared/lib";
import { useAppStore, useOrganizationsStore } from "@rooms/app/stores";

const LoginScreen = defineAsyncComponent(
  () => import("@rooms/widgets/login-screen/ui/LoginScreen.vue"),
);
const RegisterScreen = defineAsyncComponent(
  () => import("@rooms/widgets/register-screen/ui/RegisterScreen.vue"),
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
const OrgScreen = defineAsyncComponent(
  () => import("@rooms/widgets/org-screen/ui/OrgScreen.vue"),
);
const OrganizationsListScreen = defineAsyncComponent(
  () =>
    import("@rooms/widgets/organizations-list/ui/OrganizationsListScreen.vue"),
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
    orgStore.clearSelected();
    replaceState();
  },
});
const organizationApi = new OrganizationApi(apiClient);

provide("apiClient", apiClient);
provide(API_BASE_URL_INJECT_KEY, apiBaseURL);
provide(LIVEKIT_URL_INJECT_KEY, livekitURL);

const appStore = useAppStore();
const orgStore = useOrganizationsStore();
useMeetingShortcutListener();
const { organizations, loading, selectedOrgId } = storeToRefs(orgStore);

const isScrollRootPage = computed(
  () =>
    appStore.showReconnectScreen ||
    appStore.page === "login" ||
    appStore.page === "register" ||
    appStore.page === "invite" ||
    appStore.page === "create-org" ||
    appStore.page === "settings" ||
    appStore.page === "org-settings" ||
    (!isAuthenticated() && !appStore.roomCode),
);

function parseRoute() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  appStore.setRoomCode(code || null);
  if (appStore.roomCode) {
    return;
  }
  const p = params.get("page");
  const id = params.get("id");
  const token = params.get("token");
  if (p === "login") {
    appStore.setPage("login");
    appStore.setInviteToken(null);
    orgStore.clearSelected();
  } else if (p === "register") {
    appStore.setPage("register");
    appStore.setInviteToken(null);
    orgStore.clearSelected();
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
    appStore.setPage("org-settings");
    appStore.setInviteToken(null);
    orgStore.setSelectedId(id);
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
  if (appStore.page === "login") {
    query = "?page=login";
  } else if (appStore.page === "register") {
    query = "?page=register";
  } else if (appStore.page === "invite" && appStore.inviteToken) {
    query = `?page=invite&token=${encodeURIComponent(appStore.inviteToken)}`;
  } else if (appStore.page === "create-org") {
    query = "?page=create-org";
  } else if (appStore.page === "settings") {
    query = "?page=settings";
  } else if (appStore.page === "org-settings" && orgStore.selectedOrgId) {
    query = `?page=org-settings&id=${orgStore.selectedOrgId}`;
  } else if (appStore.page === "org" && orgStore.selectedOrgId) {
    query = `?page=org&id=${orgStore.selectedOrgId}`;
  } else if (orgStore.selectedOrgId) {
    query = `?page=organizations&id=${orgStore.selectedOrgId}`;
  } else {
    query = "?page=organizations";
  }
  window.history.replaceState(null, "", `${window.location.pathname}${query}`);
}

function goToOrganizations() {
  appStore.setPage("organizations");
  replaceState();
}

function handleOrgBack() {
  orgStore.clearSelected();
  goToOrganizations();
}

function goToLoginFromInvite() {
  if (appStore.inviteToken) appStore.setPendingInviteAfterLogin(appStore.inviteToken);
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
}

function handleAuthSuccess() {
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
}

function handleLogout() {
  appStore.setPage("login");
  replaceState();
}

function handleGoSettings() {
  appStore.setPage("settings");
  replaceState();
}

function handleOrgSettings() {
  appStore.setPage("org-settings");
  replaceState();
}

function handleOrgSettingsBack() {
  appStore.setPage("org");
  replaceState();
}

function handleOrgDeleted() {
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

watch(
  [
    () => appStore.page,
    () => appStore.inviteToken,
    () => appStore.roomCode,
    () => orgStore.selectedOrgId,
  ],
  replaceState,
);

function loadOrganizations() {
  orgStore.loadOrganizations(organizationApi);
}

onMounted(() => {
  parseRoute();
  const publicPages = ["login", "register", "invite"];
  if (!isAuthenticated() && !publicPages.includes(appStore.page)) {
    appStore.setRoomCode(null);
    appStore.setPage("login");
    replaceState();
    return;
  }
  if (
    !isAuthenticated() &&
    appStore.page === "invite" &&
    !appStore.inviteToken
  ) {
    appStore.setPage("login");
    replaceState();
    return;
  }
  if (
    appStore.page === "organizations" ||
    (appStore.page === "org" && orgStore.selectedOrgId)
  ) {
    loadOrganizations();
  }
});

window.addEventListener("popstate", parseRoute);
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
}

.rooms-app--scroll-root {
  height: 100dvh;
  height: 100vh;
  overflow-y: auto;
}

.rooms-app--scroll-root .rooms-app__content {
  flex: none;
  overflow: visible;
}

.rooms-app__main {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.rooms-app__content {
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
  flex: 1;
  min-height: 0;
  overflow: auto;
  position: relative;
  z-index: 10000;
}

.rooms-app__room {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
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
  padding: 24px 28px;
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
