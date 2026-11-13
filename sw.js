// ArchMentor service worker: fast repeat visits and an offline page.
// Never caches API calls, sign-in, payments or private files — those always go to the network.
const VERSION = 'am-v3';
const CORE = ['./', './offline.html', './manifest.webmanifest', './icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                 // Supabase, Razorpay, fonts: network only
  if (req.mode === 'navigate') {
    // pages: network first, cached shell or offline page when there is no connection
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('./', copy)); return res; })
      .catch(() => caches.match('./').then((r) => r || caches.match('./offline.html'))));
    return;
  }
  if (/\/assets\/.+\.(js|css|woff2?)$/.test(url.pathname) || /\.(png|svg|webmanifest)$/.test(url.pathname)) {
    // hashed build files: cache first
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })));
  }
});
