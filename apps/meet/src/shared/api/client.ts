export interface ApiConfig {
  baseURL: string;
  timeout?: number;
  getAuthHeaders?: () => Record<string, string>;
  onUnauthorized?: () => void;
  onBackendError?: () => void;
  refreshAuth?: () => Promise<boolean>;
}

export class ApiClient {
  private baseURL: string;
  private timeout: number;
  private getAuthHeaders?: () => Record<string, string>;
  private onUnauthorized?: () => void;
  private onBackendError?: () => void;
  private refreshAuth?: () => Promise<boolean>;

  constructor(config: ApiConfig) {
    this.baseURL = config.baseURL.replace(/\/$/, "");
    this.timeout = config.timeout || 30000;
    this.getAuthHeaders = config.getAuthHeaders;
    this.onUnauthorized = config.onUnauthorized;
    this.onBackendError = config.onBackendError;
    this.refreshAuth = config.refreshAuth;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetryAfterRefresh = false,
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
      ...this.getAuthHeaders?.(),
    };

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers,
      });

      clearTimeout(timeoutId);

      if (response.status === 401 && !isRetryAfterRefresh && this.refreshAuth) {
        const refreshed = await this.refreshAuth();
        if (refreshed) {
          return this.request<T>(endpoint, options, true);
        }
        this.onUnauthorized?.();
        const error = await response.json().catch(() => ({ error: "Unauthorized" }));
        throw new Error(error.error || "Unauthorized");
      }

      if (response.status === 401) {
        this.onUnauthorized?.();
        const error = await response.json().catch(() => ({ error: "Unauthorized" }));
        throw new Error(error.error || "Unauthorized");
      }

      if (!response.ok) {
        if (response.status >= 500) {
          this.onBackendError?.();
        }
        const error = await response
          .json()
          .catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      if (response.status === 204) {
        return undefined as T;
      }
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      const isNetworkOrAbort =
        error instanceof TypeError ||
        (error instanceof Error && error.name === "AbortError");
      if (error instanceof Error && !isNetworkOrAbort) {
        throw error;
      }
      if (isNetworkOrAbort || !(error instanceof Error)) {
        this.onBackendError?.();
      }
      throw new Error("Network error");
    }
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const init: RequestInit = {
      ...options,
      method: "GET",
      cache: "no-store",
    };
    return this.request<T>(endpoint, init);
  }

  async post<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestInit,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestInit,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestInit,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}
