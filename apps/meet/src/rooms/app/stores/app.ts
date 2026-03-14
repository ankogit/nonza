import { defineStore } from "pinia";
import { ref } from "vue";
import type { AppPage } from "./types";

export const useAppStore = defineStore("app", () => {
  const page = ref<AppPage>("organizations");
  const inviteToken = ref<string | null>(null);
  const pendingInviteAfterLogin = ref<string | null>(null);
  const roomCode = ref<string | null>(null);
  const showReconnectScreen = ref(false);

  function setPage(p: AppPage) {
    page.value = p;
  }

  function setInviteToken(token: string | null) {
    inviteToken.value = token;
  }

  function setPendingInviteAfterLogin(token: string | null) {
    pendingInviteAfterLogin.value = token;
  }

  function setRoomCode(code: string | null) {
    roomCode.value = code;
  }

  function setShowReconnectScreen(show: boolean) {
    showReconnectScreen.value = show;
  }

  function clearInviteAndPending() {
    inviteToken.value = null;
    pendingInviteAfterLogin.value = null;
  }

  return {
    page,
    inviteToken,
    pendingInviteAfterLogin,
    roomCode,
    showReconnectScreen,
    setPage,
    setInviteToken,
    setPendingInviteAfterLogin,
    setRoomCode,
    setShowReconnectScreen,
    clearInviteAndPending,
  };
});
