export interface OAuthAuthorizeInfo {
  client_id: string;
  name: string;
  trusted: boolean;
  scopes: string[];
  redirect_uri: string;
  state: string;
}

export interface OAuthApproveRequest {
  client_id: string;
  redirect_uri: string;
  state: string;
  scope?: string;
  code_challenge?: string;
  code_challenge_method?: string;
}

export interface OAuthApproveResponse {
  redirect_url: string;
}

export interface OAuthAuthorizeParams {
  clientId: string;
  redirectUri: string;
  state: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}

export function parseOAuthAuthorizeParams(
  search: string,
): OAuthAuthorizeParams | null {
  const params = new URLSearchParams(search);
  if (params.get("page") !== "oauth-authorize") return null;

  const clientId = params.get("client_id") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const state = params.get("state") ?? "";
  if (!clientId || !redirectUri || !state) return null;

  return {
    clientId,
    redirectUri,
    state,
    scope: params.get("scope") ?? "",
    codeChallenge: params.get("code_challenge") ?? "",
    codeChallengeMethod: params.get("code_challenge_method") ?? "",
  };
}

export function oauthAuthorizeInfoQuery(params: OAuthAuthorizeParams): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    state: params.state,
  });
  if (params.scope) q.set("scope", params.scope);
  if (params.codeChallenge) {
    q.set("code_challenge", params.codeChallenge);
    q.set("code_challenge_method", params.codeChallengeMethod || "S256");
  }
  return q.toString();
}
