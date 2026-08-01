/* Offline support.

   Deliberately small. The app is one HTML file and a handful of icons, so
   there's no build pipeline to mirror — cache those, serve them instantly,
   and quietly fetch a fresher copy in the background.

   Calls to Supabase are never cached. Sync must always hit the network or it
   would happily show you yesterday's library and call it success. */

const VERSION = "everything-v2";
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

  const isPage = e.request.mode === "navigate" ||
                 e.request.destination === "document";

  if (isPage) {
    /* The app itself: try the network first, fall back to the cache.
       Cache-first meant a change published today only appeared on the second
       open, which turns "push and refresh" into "push and refresh twice".
       Offline still works — the fallback is the whole point of caching it. */
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() =>
        caches.match(e.request).then(hit => hit || caches.match("./index.html"))
      )
    );
    return;
  }

  /* Everything else — icons, the manifest — barely changes, so answer from
     cache at once and refresh quietly behind it. */
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
