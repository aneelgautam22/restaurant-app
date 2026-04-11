const CACHE_NAME = "mini-pwa-v4";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  // 🔥 HTML page
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const cloned = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, cloned));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 🔥 JS / CSS / _next files (VERY IMPORTANT)
  if (
    req.url.includes("_next") ||
    req.url.endsWith(".js") ||
    req.url.endsWith(".css")
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        return (
          cached ||
          fetch(req).then((res) => {
            const cloned = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, cloned));
            return res;
          })
        );
      })
    );
    return;
  }

  // 🔥 others (images etc)
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});