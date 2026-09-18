/* Nonza PWA — network-first shell, no offline media cache (WebRTC/LiveKit). */
const CACHE = "nonza-shell-v1";
const PRECACHE = ["/", "/manifest.webmanifest", "/icons/pwa/icon-192.png", "/icons/pwa/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API, websockets upgrade, workers, media — всегда сеть
  if (
    url.pathname.startsWith("/api") ||
    url.pathname.includes("livekit") ||
    url.pathname.startsWith("/audio-worklets") ||
    request.destination === "worker" ||
    request.destination === "sharedworker"
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (
          response.ok &&
          (request.mode === "navigate" ||
            url.pathname === "/" ||
            url.pathname.endsWith(".webmanifest") ||
            url.pathname.startsWith("/icons/pwa/"))
        ) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const shell = await caches.match("/");
          if (shell) return shell;
        }
        throw new Error("offline");
      }),
  );
});
