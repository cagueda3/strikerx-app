// Lets StrikeRX open with no signal at the lanes.
// It shows the saved copy straight away and fetches a newer one in the background,
// so an update appears the next time the app is opened.
// The cache only holds the app's own files. Bowling data is never stored here.
// Both downloads skip the browser's own short-term copy (GitHub Pages lets a phone reuse a file
// for 10 minutes). Without that, opening the app just before a publish kept the old version saved
// for up to 10 minutes, even under the new build's name.
const CACHE = "strikerx-shell-1.5.13-202611162207";
const SHELL = ["./", "index.html", "unlock.js", "app.enc", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("strikerx-shell-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      // "no-cache" asks the server every time; an unchanged file comes back as a tiny "not modified".
      const fresh = fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => cached);
      return cached || fresh;
    })
  );
});
