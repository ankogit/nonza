const STORAGE_KEY = "nonza_desktop_shortcuts";

export const DEFAULT_SHORTCUTS = {
  audio: "CommandOrControl+Shift+M",
  video: "CommandOrControl+Shift+V",
  leave: "CommandOrControl+Shift+H",
  sound: "CommandOrControl+Shift+O",
} as const;

export type ShortcutBindings = {
  audio: string;
  video: string;
  leave: string;
  sound: string;
};

export function getStoredShortcuts(): ShortcutBindings {
  if (typeof window === "undefined") return { ...DEFAULT_SHORTCUTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SHORTCUTS };
    const parsed = JSON.parse(raw) as Partial<ShortcutBindings>;
    return {
      audio: parsed.audio ?? DEFAULT_SHORTCUTS.audio,
      video: parsed.video ?? DEFAULT_SHORTCUTS.video,
      leave: parsed.leave ?? DEFAULT_SHORTCUTS.leave,
      sound: parsed.sound ?? DEFAULT_SHORTCUTS.sound,
    };
  } catch {
    return { ...DEFAULT_SHORTCUTS };
  }
}

export function storeShortcuts(bindings: ShortcutBindings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    // ignore
  }
}

export function shortcutToDisplay(shortcut: string): string {
  const isMac =
    (import.meta.env as { TAURI_ENV_PLATFORM?: string }).TAURI_ENV_PLATFORM ===
    "darwin";
  return shortcut
    .replace(/CommandOrControl/gi, isMac ? "⌘" : "Ctrl")
    .replace(/\+/g, "+")
    .replace(/Shift/gi, "⇧")
    .replace(/Alt/gi, "⌥");
}

const MODIFIER_KEYS = new Set([
  "Meta",
  "Control",
  "Shift",
  "Alt",
  "OS",
]);

export function isModifierOnlyKey(key: string): boolean {
  return MODIFIER_KEYS.has(key);
}

export function keyEventToShortcut(e: KeyboardEvent): string {
  if (isModifierOnlyKey(e.key)) {
    return "";
  }
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("CommandOrControl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  let key = e.key;
  if (key.length === 1 && /[a-z]/i.test(key)) key = key.toUpperCase();
  else if (key === " ") key = "Space";
  parts.push(key);
  return parts.join("+");
}
