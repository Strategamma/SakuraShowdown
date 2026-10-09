const CACHE = "sakura-showdown-v5";
const APP_SHELL = [
  "./manifest.webmanifest",
  "./sakura-icon.svg",
  "./sakura-icon-192.png",
  "./sakura-icon-512.png",
  "./sakura-icon-maskable-512.png",
  "./game.json"
];

function localDocumentAssets(html) {
  const scope = new URL(self.registration.scope);
  const assets = new Set();
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const url = new URL(match[1], scope);
    if (url.origin === scope.origin) assets.add(url.href);
  }
  return [...assets];
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE);
  const entryUrl = new URL("./", self.registration.scope);
  const response = await fetch(entryUrl, { cache: "reload" });
  if (!response.ok) throw new Error(`Unable to cache app entry (${response.status})`);

  await cache.put(entryUrl, response.clone());
  const discoveredAssets = localDocumentAssets(await response.text());
  const requiredAssets = APP_SHELL.map((path) => new URL(path, self.registration.scope).href);
  await cache.addAll([...new Set([...requiredAssets, ...discoveredAssets])]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell());
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
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === "navigate") {
            return caches.match(new URL("./", self.registration.scope));
          }
          return undefined;
        })
      )
  );
});
