/**
 * Screen Wake Lock API: prevents device from sleeping (e.g. during a call).
 * Supported in Safari 16.4+ (iOS 16.4+), Chrome 84+, modern Firefox.
 */

function isWakeLockSupported(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

export interface UseScreenWakeLockOptions {
  /** When true, request wake lock; when false, release. */
  active: () => boolean;
}

export function useScreenWakeLock(options: UseScreenWakeLockOptions) {
  const { active } = options;
  let sentinel: WakeLockSentinel | null = null;

  async function requestLock(): Promise<void> {
    if (!isWakeLockSupported() || !active()) return;
    if (document.visibilityState !== "visible") return;
    try {
      sentinel = await navigator.wakeLock.request("screen");
      sentinel.addEventListener("release", onRelease);
    } catch {
      // Low battery, permission denied, or already active
    }
  }

  function onRelease() {
    sentinel?.removeEventListener("release", onRelease);
    sentinel = null;
  }

  async function releaseLock(): Promise<void> {
    if (!sentinel) return;
    try {
      await sentinel.release();
    } finally {
      onRelease();
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === "visible" && active()) {
      requestLock();
    } else {
      releaseLock();
    }
  }

  return {
    requestLock,
    releaseLock,
    onVisibilityChange,
    isSupported: isWakeLockSupported(),
  };
}
