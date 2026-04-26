import { shallowRef } from "vue";

export type ToastVariant = "default" | "success" | "info" | "warning" | "danger";

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  icon?: string;
}

let nextId = 0;
const toasts = shallowRef<ToastItem[]>([]);
const DEFAULT_DURATION_MS = 4000;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function removeToast(id: number) {
  const t = timers.get(id);
  if (t) {
    clearTimeout(t);
    timers.delete(id);
  }
  toasts.value = toasts.value.filter((item) => item.id !== id);
}

const DEFAULT_ICON: Record<ToastVariant, string | undefined> = {
  default: undefined,
  success: "check",
  info: "message",
  warning: "connection-good",
  danger: "close",
};

export function showToast(
  message: string,
  options?: { variant?: ToastVariant; icon?: string; duration?: number }
) {
  const id = ++nextId;
  const variant = options?.variant ?? "default";
  const icon = options?.icon ?? DEFAULT_ICON[variant];
  const duration = options?.duration ?? DEFAULT_DURATION_MS;
  toasts.value = [...toasts.value, { id, message, variant, icon }];
  const timer = setTimeout(() => {
    removeToast(id);
  }, duration);
  timers.set(id, timer);
}

export function dismissToast(id: number) {
  removeToast(id);
}

export function useToasts() {
  return { toasts };
}
