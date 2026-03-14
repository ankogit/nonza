import { inject } from "vue";

const API_BASE_URL_DEFAULT = "http://localhost:8000";
const LIVEKIT_URL_DEFAULT = "ws://localhost:7880";

export const API_BASE_URL_INJECT_KEY = "apiBaseURL";
export const LIVEKIT_URL_INJECT_KEY = "livekitURL";

export function getApiBaseURL(override?: string): string {
  return override ?? import.meta.env.VITE_API_BASE_URL ?? API_BASE_URL_DEFAULT;
}

export function getLivekitURL(override?: string): string {
  return override ?? import.meta.env.VITE_LIVEKIT_URL ?? LIVEKIT_URL_DEFAULT;
}

export function useAppConfig(): { apiBaseURL: string; livekitURL: string } {
  const injectedBase = inject<string | undefined>(API_BASE_URL_INJECT_KEY);
  const injectedLivekit = inject<string | undefined>(LIVEKIT_URL_INJECT_KEY);
  return {
    apiBaseURL: getApiBaseURL(injectedBase),
    livekitURL: getLivekitURL(injectedLivekit),
  };
}
