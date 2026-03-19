import { isTauriDesktop } from "./openCallInNewWindow";

function isHttpUrl(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

/**
 * In Tauri desktop, open external http(s) links in the system browser.
 * WebView often blocks `target="_blank"`/`window.open()` and tries to navigate internally.
 */
export function setupExternalLinks(): () => void {
  if (!isTauriDesktop()) return () => {};

  const onClick = async (event: MouseEvent) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const target = event.target as Element | null;
    const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
    if (!anchor) return;
    if (anchor.hasAttribute("download")) return;

    const href = anchor.getAttribute("href") ?? "";
    if (!isHttpUrl(href)) return;

    event.preventDefault();
    event.stopPropagation();

    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(href);
    } catch (e) {
      console.warn("[external-links] failed to open url", href, e);
    }
  };

  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}

