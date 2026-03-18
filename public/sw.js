const CACHE_NAME = "sst-backoffice-v2";
const OFFLINE_FALLBACK = "/en/login";
const PRECACHE_URLS = ["/manifest.webmanifest", "/en/login", "/th/login"];

function shouldCacheAsset(request) {
  if (request.method !== "GET") {
    return false;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return false;
  }

  if (request.mode === "navigate") {
    return false;
  }

  return ["script", "style", "image", "font"].includes(request.destination);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone)));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) {
            return cached;
          }
          const fallback = await caches.match(OFFLINE_FALLBACK);
          return fallback ?? Response.error();
        }),
    );
    return;
  }

  if (!shouldCacheAsset(request)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone)));
          }
          return response;
        })
        .catch(() => cached ?? Response.error());
    }),
  );
});
