/**
 * Helper functions for LiveKit integration
 */

/**
 * Normalizes LiveKit WebSocket URL
 * Converts http/https to ws/wss and ensures proper format
 */
export function normalizeLiveKitUrl(url: string): string {
  if (!url) {
    throw new Error("LiveKit URL is required");
  }

  // Special handling: wss://localhost or wss://127.0.0.1 should use ws:// for local development
  // (LiveKit local dev server typically doesn't have SSL)
  if (url.startsWith("wss://localhost") || url.startsWith("wss://127.0.0.1")) {
    return url.replace("wss://", "ws://");
  }

  // If already WebSocket URL, return as is
  if (url.startsWith("ws://") || url.startsWith("wss://")) {
    return url;
  }

  // Convert http/https to ws/wss
  if (url.startsWith("http://")) {
    return url.replace("http://", "ws://");
  }

  if (url.startsWith("https://")) {
    return url.replace("https://", "wss://");
  }

  // If no protocol, assume ws:// for localhost, wss:// otherwise
  if (url.includes("localhost") || url.includes("127.0.0.1")) {
    return `ws://${url}`;
  }

  return `wss://${url}`;
}

/**
 * Validates LiveKit token format (basic check)
 */
export function isValidToken(token: string): boolean {
  if (!token || typeof token !== "string") {
    return false;
  }

  // JWT tokens have 3 parts separated by dots
  const parts = token.split(".");
  return parts.length === 3;
}
