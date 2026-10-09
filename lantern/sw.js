/*
 * Lantern's offline copy. Pages, styles, and scripts are fetched fresh when
 * the network answers and kept for when it does not, so solo play still opens
 * offline. The shared table (/api/) always goes to the network.
 */
const CACHE = "lantern-shell-v2";
const SHELL = [
  "/",
  "/index.html",
  "/player.html",
  "/dm.html",
  "/styles.css",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/icons/lantern-192.png",
  "/src/app.js",
  "/src/character.js",
  "/src/dice.js",
  "/src/dm.js",
  "/src/encounter.js",
  "/src/gear.js",
  "/src/lights.js",
  "/src/marks.js",
  "/src/oracle.js",
  "/src/order.js",
  "/src/qr.js",
  "/src/pwa.js",
  "/src/roster.js",
  "/src/screen.js",
  "/src/store.js",
  "/src/table.js",
  "/src/talk.js",
  "/src/textsize.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })
        .then((hit) => hit || caches.match("/index.html"))),
  );
});
