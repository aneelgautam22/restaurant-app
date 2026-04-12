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

  // HTML page
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

  // JS / CSS / _next files
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

  // images and other files
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

// Push notification received
self.addEventListener("push", (event) => {
  let data = {
    title: "Order Ready",
    body: "A table order is ready",
    url: "/",
  };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (error) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [200, 100, 200],
      requireInteraction: true,
      data: {
        url: data.url || "/",
      },
    })
  );
});

// Notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          return;
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});