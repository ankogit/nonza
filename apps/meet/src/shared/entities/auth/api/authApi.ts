import type { ApiClient } from "@shared/api";
import type { AuthResponse, LoginRequest, RegisterRequest, AuthMethods } from "../model/types";

export class AuthApi {
  constructor(private client: ApiClient) {}

  async getAuthMethods(): Promise<AuthMethods> {
    return this.client.get<AuthMethods>("/api/v1/auth/methods");
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    return this.client.post<AuthResponse>("/api/v1/auth/login", data);
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    return this.client.post<AuthResponse>("/api/v1/auth/register", data);
  }

  async exchangeSocialTicket(ticket: string): Promise<AuthResponse> {
    return this.client.post<AuthResponse>("/api/v1/auth/social/exchange", {
      ticket,
    });
  }

  async updateMe(data: {
    name: string;
    color?: string | null;
  }): Promise<{ user: AuthResponse["user"] }> {
    return this.client.patch<{ user: AuthResponse["user"] }>("/api/v1/auth/me", data);
  }
}
