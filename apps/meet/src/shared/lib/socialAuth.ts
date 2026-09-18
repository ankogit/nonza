export function buildSocialLoginReturnUrl(page: "login" | "register" = "login"): string {
  const path = window.location.pathname || "/";
  return `${window.location.origin}${path}?page=${page}`;
}

export function buildGoogleLoginUrl(apiBaseURL: string, page: "login" | "register" = "login"): string {
  const base = apiBaseURL.replace(/\/$/, "");
  const returnUrl = buildSocialLoginReturnUrl(page);
  return `${base}/api/v1/auth/google/start?return_url=${encodeURIComponent(returnUrl)}`;
}

export function buildMandarinshowLoginUrl(
  apiBaseURL: string,
  page: "login" | "register" = "login",
): string {
  const base = apiBaseURL.replace(/\/$/, "");
  const returnUrl = buildSocialLoginReturnUrl(page);
  return `${base}/api/v1/auth/mandarinshow/start?return_url=${encodeURIComponent(returnUrl)}`;
}

export function buildKeycloakLoginUrl(
  apiBaseURL: string,
  page: "login" | "register" = "login",
): string {
  const base = apiBaseURL.replace(/\/$/, "");
  const returnUrl = buildSocialLoginReturnUrl(page);
  return `${base}/api/v1/auth/keycloak/start?return_url=${encodeURIComponent(returnUrl)}`;
}
