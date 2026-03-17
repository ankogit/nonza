import { ref, shallowRef } from "vue";

export interface AppUpdateInfo {
  version: string;
  body?: string | null;
  date?: string | null;
  downloadAndInstall: (onEvent?: (event: unknown) => void) => Promise<void>;
}

function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  if (w.__TAURI__ ?? w.__TAURI_INTERNALS__) return true;
  const env = import.meta.env as { TAURI_ENV_PLATFORM?: string };
  return (
    typeof env.TAURI_ENV_PLATFORM === "string" &&
    env.TAURI_ENV_PLATFORM.length > 0
  );
}

export function useAppUpdate() {
  const isTauriApp = isTauri();
  const currentVersion = ref<string>("");
  const checking = ref(false);
  const update = shallowRef<AppUpdateInfo | null>(null);
  const downloading = ref(false);
  const error = ref<string | null>(null);

  async function loadVersion() {
    if (!isTauriApp) return;
    try {
      const app = await import("@tauri-apps/api/app");
      currentVersion.value = await app.getVersion();
    } catch {
      // ignore
    }
  }

  async function check() {
    if (!isTauriApp) return;
    checking.value = true;
    error.value = null;
    update.value = null;
    try {
      const { check: checkForUpdate } = await import(
        "@tauri-apps/plugin-updater"
      );
      const result = await checkForUpdate();
      if (result) {
        update.value = {
          version: result.version,
          body: result.body ?? null,
          date: result.date ?? null,
          downloadAndInstall: result.downloadAndInstall.bind(result),
        };
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : String(e);
      error.value = message;
    } finally {
      checking.value = false;
    }
  }

  async function install() {
    const u = update.value;
    if (!u || !isTauriApp) return;
    downloading.value = true;
    error.value = null;
    try {
      await u.downloadAndInstall((event) => {
        if (
          event &&
          typeof event === "object" &&
          "event" in event &&
          event.event === "Finished"
        ) {
          // progress done
        }
      });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : String(e);
      error.value = message;
    } finally {
      downloading.value = false;
    }
  }

  return {
    isTauriApp,
    currentVersion,
    checking,
    update,
    downloading,
    error,
    loadVersion,
    check,
    install,
  };
}
