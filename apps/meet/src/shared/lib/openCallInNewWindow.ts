export function isTauriDesktop(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
  if (w.__TAURI__ ?? w.__TAURI_INTERNALS__) return true;
  const env = import.meta.env as { TAURI_ENV_PLATFORM?: string };
  return typeof env.TAURI_ENV_PLATFORM === "string" && env.TAURI_ENV_PLATFORM.length > 0;
}

function isTauri(): boolean {
  return isTauriDesktop();
}

export async function openCallInNewWindow(roomCode: string): Promise<void> {
  if (!isTauri() || !roomCode?.trim()) return;
  const code = roomCode.trim();
  const base = `${window.location.origin}${window.location.pathname}`.replace(/\/$/, "") || "/";
  const url = `${base}?code=${encodeURIComponent(code)}`;
  const label = `call-${code}-${Date.now()}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const win = new WebviewWindow(label, {
    url,
    title: "Nonza Meet",
    width: 1000,
    height: 800,
    minWidth: 800,
    minHeight: 600,
  });
  win.once("tauri://error", (e) => {
    console.error("[openCallInNewWindow]", e);
  });
}
