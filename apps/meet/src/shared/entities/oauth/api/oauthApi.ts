import type { ApiClient } from "@shared/api";
import type {
  OAuthApproveRequest,
  OAuthApproveResponse,
  OAuthAuthorizeInfo,
  OAuthAuthorizeParams,
} from "../model/types";
import { oauthAuthorizeInfoQuery } from "../model/types";

export class OAuthApi {
  constructor(private client: ApiClient) {}

  getAuthorizeInfo(params: OAuthAuthorizeParams): Promise<OAuthAuthorizeInfo> {
    return this.client.get<OAuthAuthorizeInfo>(
      `/api/v1/oauth/authorize-info?${oauthAuthorizeInfoQuery(params)}`,
    );
  }

  approve(data: OAuthApproveRequest): Promise<OAuthApproveResponse> {
    return this.client.post<OAuthApproveResponse>("/api/v1/oauth/approve", data);
  }
}
