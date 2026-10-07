const CACHE = "sakura-showdown-v3";
const APP_SHELL = [
  "./",
  "./manifest.webmanifest",
  "./sakura-icon.svg",
  "./sakura-icon-192.png",
  "./sakura-icon-512.png",
  "./sakura-icon-maskable-512.png",
  "./game.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./")))
  );
});
