declare global {
  interface Window {
    __setBootProgress?: (pct: number, label?: string) => void;
  }
}

export function setBootProgress(pct: number, label?: string) {
  window.__setBootProgress?.(pct, label);
}

export function dismissBootSplash() {
  setBootProgress(100, "Готово");

  const el = document.getElementById("boot-splash");
  if (!el) return;

  const finish = () => {
    el.remove();
  };

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    finish();
    return;
  }

  el.classList.add("boot-splash--hide");
  window.setTimeout(finish, 380);
}
