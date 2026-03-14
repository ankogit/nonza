import { inject } from "vue";
import { getApiBaseURL, useAppConfig } from "@shared/lib";
import { ApiClient } from "./client";

const API_CLIENT_INJECT_KEY = "apiClient";

export function useApiClient(): ApiClient {
  const injected = inject<ApiClient | undefined>(API_CLIENT_INJECT_KEY);
  if (injected != null) return injected;
  const { apiBaseURL } = useAppConfig();
  return new ApiClient({ baseURL: apiBaseURL });
}
