export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  color?: string | null;
}

export interface AuthResponse {
  access_token: string;
  expires_at: string;
  refresh_token?: string;
  refresh_expires_at?: string;
  user: { id: string; email: string; name?: string; color?: string | null };
}
