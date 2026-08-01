/* Offline support.

   Deliberately small. The app is one HTML file and a handful of icons, so
   there's no build pipeline to mirror — cache those, serve them instantly,
   and quietly fetch a fresher copy in the background.

   Calls to Supabase are never cached. Sync must always hit the network or it
   would happily show you yesterday's library and call it success. */

const VERSION = "everything-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/192.png",
  "./icons/512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // anything that isn't this site — Supabase above all — goes straight out
  if (url.origin !== self.location.origin) return;
  if (e.request.method !== "GET") return;

  // Stale-while-revalidate: answer from cache at once, refresh behind your
  // back, so the next open has the new version without ever making you wait.
  e.respondWith(
    caches.open(VERSION).then(cache =>
      cache.match(e.request).then(hit => {
        const live = fetch(e.request).then(res => {
          if (res && res.status === 200) cache.put(e.request, res.clone());
          return res;
        }).catch(() => hit);
        return hit || live;
      })
    )
  );
});
