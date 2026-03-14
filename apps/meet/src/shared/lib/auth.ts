const AUTH_STORAGE_KEY = "nonza_auth";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  color?: string | null;
}

export interface AuthState {
  accessToken: string;
  expiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
  user: AuthUser;
}

let state: AuthState | null = null;

function loadFromStorage(): AuthState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthState> & { user?: AuthUser };
    if (!parsed.user?.id) return null;
    if (!parsed.accessToken && !parsed.refreshToken) return null;
    return {
      accessToken: parsed.accessToken ?? "",
      expiresAt: parsed.expiresAt ?? "",
      refreshToken: parsed.refreshToken ?? "",
      refreshExpiresAt: parsed.refreshExpiresAt ?? "",
      user: parsed.user,
    };
  } catch {
    // ignore
  }
  return null;
}

function saveToStorage(s: AuthState | null) {
  if (typeof window === "undefined") return;
  if (s) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(s));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

export function getAuthState(): AuthState | null {
  if (state === null) state = loadFromStorage();
  return state;
}

export function setAuth(
  accessToken: string,
  expiresAt: string,
  user: AuthUser,
  refreshToken?: string,
  refreshExpiresAt?: string,
) {
  state = {
    accessToken,
    expiresAt,
    refreshToken: refreshToken ?? state?.refreshToken ?? "",
    refreshExpiresAt: refreshExpiresAt ?? state?.refreshExpiresAt ?? "",
    user,
  };
  saveToStorage(state);
}

export function updateAuthUser(partial: Partial<AuthUser>) {
  const s = getAuthState();
  if (!s?.user) return;
  s.user = { ...s.user, ...partial };
  state = s;
  saveToStorage(state);
}

export function clearAuth() {
  state = null;
  saveToStorage(null);
}

export function getAuthHeaders(): Record<string, string> {
  const s = getAuthState();
  if (!s?.accessToken) return {};
  return { Authorization: `Bearer ${s.accessToken}` };
}

export function getRefreshToken(): string | null {
  const s = getAuthState();
  return s?.refreshToken ?? null;
}

export async function refreshAccessToken(baseURL: string): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  const url = `${baseURL.replace(/\/$/, "")}/api/v1/auth/refresh`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) {
      clearAuth();
      return false;
    }
    const data = (await res.json()) as {
      access_token: string;
      expires_at: string;
      refresh_token: string;
      refresh_expires_at: string;
      user: { id: string; email: string; name?: string; color?: string | null };
    };
    setAuth(
      data.access_token,
      data.expires_at,
      {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        color: data.user.color,
      },
      data.refresh_token,
      data.refresh_expires_at,
    );
    return true;
  } catch {
    clearAuth();
    return false;
  }
}

export function isAuthenticated(): boolean {
  return getAuthState() != null;
}

export interface ParticipantInfo {
  displayName: string;
  identity: string;
}

export function getParticipantInfoFromAuth(): ParticipantInfo | null {
  const s = getAuthState();
  if (!s?.user?.id) return null;
  const name = (s.user.name || s.user.email || "").trim();
  return {
    displayName: name || s.user.id,
    identity: s.user.id,
  };
}
