function isTauriRuntime(): boolean {
  const w = window as unknown as {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  return !!(w.__TAURI__ ?? w.__TAURI_INTERNALS__);
}

/** Registers SW for installable standalone web (iOS/Android). Skip in Tauri and non-secure contexts. */
export function registerPwa(): void {
  if (typeof window === "undefined") return;
  if (isTauriRuntime()) return;
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator)) return;
  if (!window.isSecureContext) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  });
}
