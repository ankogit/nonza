# OAuth2 integration for third-party UI clients

Nonza acts as an OAuth2 authorization server. Trusted partners register a `client_id` / `client_secret` pair and use the Authorization Code flow (with PKCE recommended) to obtain user access tokens for the existing `/api/v1/*` API.

## 1. Register a client (admin)

From the backend directory:

```bash
go run ./cmd/oauth-client create \
  --name "Partner App" \
  --redirect-uris "https://partner.example/oauth/callback" \
  --scopes "openid,profile,offline_access" \
  --trusted
```

The command prints `client_id` and `client_secret` once. Store the secret on the partner backend only.

Set `OAUTH_UI_BASE_URL` in backend `.env` to the public URL of the rooms SPA (default `http://localhost:3001`).

## 2. Authorization Code flow

### Step 1 — Redirect the user

Send the browser to:

```
GET {API_BASE}/oauth/authorize?client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}&response_type=code&state={STATE}&scope=openid%20profile%20offline_access&code_challenge={CHALLENGE}&code_challenge_method=S256
```

Nonza validates the request and redirects to the rooms authorize UI. Logged-in users of **trusted** clients are approved automatically.

### Step 2 — Exchange the code

Partner backend (confidential client):

```bash
curl -s -X POST "{API_BASE}/oauth/token" \
  -u "{CLIENT_ID}:{CLIENT_SECRET}" \
  -d "grant_type=authorization_code" \
  -d "code={CODE}" \
  -d "redirect_uri={REDIRECT_URI}" \
  -d "code_verifier={CODE_VERIFIER}"
```

Response:

```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 1800,
  "refresh_token": "...",
  "scope": "offline_access openid profile"
}
```

### Step 3 — Call Nonza API

```bash
curl -s "{API_BASE}/api/v1/organizations" \
  -H "Authorization: Bearer {ACCESS_TOKEN}"
```

### User info (optional)

```bash
curl -s "{API_BASE}/oauth/userinfo" \
  -H "Authorization: Bearer {ACCESS_TOKEN}"
```

## 3. PKCE (recommended)

Generate a `code_verifier` (43–128 URL-safe characters) and:

```
code_challenge = BASE64URL(SHA256(code_verifier))
code_challenge_method = S256
```

Public clients must use PKCE. Confidential clients should use PKCE as well.

## 4. Refresh token

```bash
curl -s -X POST "{API_BASE}/oauth/token" \
  -u "{CLIENT_ID}:{CLIENT_SECRET}" \
  -d "grant_type=refresh_token" \
  -d "refresh_token={REFRESH_TOKEN}"
```

Refresh tokens are bound to the issuing `client_id` and stored server-side (rotation on refresh).

## 5. Revoke refresh token

```bash
curl -s -X POST "{API_BASE}/oauth/revoke" \
  -u "{CLIENT_ID}:{CLIENT_SECRET}" \
  -d "token={REFRESH_TOKEN}"
```

## 6. Scopes (v1)

| Scope | Meaning |
|-------|---------|
| `openid` | Subject in userinfo |
| `profile` | Name, email, color |
| `offline_access` | Issue refresh token |

## 6.1 Temporary rooms API

Create a temporary room that anyone can join by link (`allow_anonymous_join=true`, auto-expires).

Set `MEETS_PUBLIC_BASE_URL` in backend `.env` (default `http://localhost:3002`). Responses include `join_url`.

### A) User access token

```bash
curl -s -X POST "{API_BASE}/api/v1/rooms/temporary" \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "{ORG_ID}",
    "name": "Quick call",
    "room_type": "round_table",
    "expires_in": "2h"
  }'
```

### B) Partner client credentials (server-to-server)

Register the client bound to an organization:

```bash
go run ./cmd/oauth-client create \
  --name "Partner App" \
  --redirect-uris "https://partner.example/oauth/callback" \
  --organization-id "{ORG_ID}" \
  --trusted
```

Then:

```bash
curl -s -X POST "{API_BASE}/api/v1/partner/temporary-rooms" \
  -u "{CLIENT_ID}:{CLIENT_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Support call",
    "room_type": "round_table",
    "expires_in": "1h"
  }'
```

Body is optional. Defaults: `name=Временная комната`, `room_type=round_table`, `expires_in=24h`.

Example response:

```json
{
  "id": "...",
  "short_code": "abc-defg-hij",
  "join_url": "https://meet.nonza.ru/?code=abc-defg-hij",
  "is_temporary": true,
  "allow_anonymous_join": true,
  "expires_at": "2026-09-18T18:00:00Z"
}
```

Share `join_url` with participants. The room is cleaned up after `expires_at`.

## 8. Rooms login: Google, MandarinShow, and Keycloak OAuth

Rooms SPA (`LoginScreen`) loads `GET /api/v1/auth/methods` and shows only enabled providers.

Backend env (master switches):

- `AUTH_ENABLE_PASSWORD` — email/password login and register (default `true`)
- `AUTH_ENABLE_GOOGLE` — Google OAuth start/callback (default `false`; also requires `GOOGLE_*`)
- `AUTH_ENABLE_MANDARINSHOW` — MandarinShow OAuth (default `false`; also requires `MANDARINSHOW_*`)
- `AUTH_ENABLE_KEYCLOAK` — Keycloak OIDC (default `false`; also requires `KEYCLOAK_*`)

1. **Google** — Nonza API OAuth2 client (`GOOGLE_CLIENT_*`, callback `/api/v1/auth/google/callback`).
2. **MandarinShow** — OAuth2 authorization code against MandarinShow:
   - Start: `GET {MANDARINSHOW_AUTHORIZE_URL}?client_id&redirect_uri&response_type=code&state` (Nonza redirects from `/api/v1/auth/mandarinshow/start`).
   - After user approves: `redirect_uri?code&state` (or `error=access_denied`).
   - Token: `POST {MANDARINSHOW_TOKEN_URL}` JSON `{ grant_type, client_id, client_secret, code }` → profile `{ id, email, name, username }`.

Nonza env:

- `MANDARINSHOW_CLIENT_ID`, `MANDARINSHOW_CLIENT_SECRET`
- `MANDARINSHOW_AUTHORIZE_URL`, `MANDARINSHOW_TOKEN_URL`
- `MANDARINSHOW_REDIRECT_URI` — must match the URI registered in MandarinShow exactly (fallback: `{AUTH_PUBLIC_BASE_URL}/api/v1/auth/mandarinshow/callback`)

3. **Keycloak** — OpenID Connect against a dedicated realm client (not `security-admin-console`):
   - Issuer: `KEYCLOAK_ISSUER` (e.g. `https://keycloak.infra.cf.team/realms/master`)
   - Start: Nonza redirects from `/api/v1/auth/keycloak/start` to `{issuer}/protocol/openid-connect/auth`
   - Callback: `{AUTH_PUBLIC_BASE_URL}/api/v1/auth/keycloak/callback` (or `KEYCLOAK_REDIRECT_URI`)
   - Env: `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, scopes `openid email profile`

Local Google redirect URI example: `http://localhost:8000/api/v1/auth/google/callback` (add in Google Cloud Console).

## 7. Error codes

| `error` | When |
|---------|------|
| `invalid_client` | Unknown client or bad secret |
| `invalid_grant` | Bad/expired code or refresh token |
| `invalid_request` | Missing/invalid parameters |
| `invalid_scope` | Unknown or disallowed scope |
| `unsupported_grant_type` | Unknown `grant_type` |
| `unsupported_response_type` | Not `code` |

## 9. Partner checklist

- [ ] Register redirect URI (exact match)
- [ ] Keep `client_secret` on server only
- [ ] Validate `state` on callback
- [ ] Add partner API origin to `CORS_ALLOWED_ORIGINS` if the browser calls Nonza directly
- [ ] Use `offline_access` only when long-lived sessions are needed

## Example (Node.js pseudo-code)

```javascript
const state = crypto.randomBytes(16).toString("hex");
const verifier = base64url(crypto.randomBytes(32));
const challenge = base64url(sha256(verifier));

const authorizeUrl = new URL(`${API_BASE}/oauth/authorize`);
authorizeUrl.searchParams.set("client_id", CLIENT_ID);
authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authorizeUrl.searchParams.set("response_type", "code");
authorizeUrl.searchParams.set("state", state);
authorizeUrl.searchParams.set("scope", "openid profile offline_access");
authorizeUrl.searchParams.set("code_challenge", challenge);
authorizeUrl.searchParams.set("code_challenge_method", "S256");

// Redirect user to authorizeUrl, then on callback:
const tokenRes = await fetch(`${API_BASE}/oauth/token`, {
  method: "POST",
  headers: {
    Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  }),
});
```
