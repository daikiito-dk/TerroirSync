/*
 * TerroirSync service worker — offline-first app shell for field use.
 *
 * Strategy:
 * - Hashed build assets and images: cache-first (immutable).
 * - Pages and everything else: network-first with cache fallback, so
 *   updates land while the last-known-good shell still works offline.
 */
const VERSION = "v1";
const SHELL_CACHE = `terroirsync-shell-${VERSION}`;
const ASSET_CACHE = `terroirsync-assets-${VERSION}`;
const SHELL_URLS = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL_URLS);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.endsWith(VERSION))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  const isBuildAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname === "/apple-touch-icon.png" ||
    /\.(?:png|jpe?g|svg|webp|ico|woff2?)$/.test(url.pathname);

  if (isBuildAsset) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            const copy = response.clone();
            caches
              .open(ASSET_CACHE)
              .then((cache) => cache.put(event.request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches
          .open(SHELL_CACHE)
          .then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(
        () =>
          caches
            .match(event.request)
            .then((cached) => cached || caches.match("/")),
      ),
  );
});
