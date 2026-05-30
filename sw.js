const CACHE_NAME = 'criclive-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
  // বাকি সব ফাইল — fonts, icons, images সব
];

// ইনস্টলে সব cache করো, কোনো একটা fail করলে পুরো install fail
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // বাইরের API call (যেমন cricket data) — Network First
  if (!e.request.url.startsWith(self.location.origin)) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // নিজের ফাইল — Cache First, তারপর Network
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;

      return fetch(e.request).then(response => {
        // নতুন ফাইল হলে cache এ রেখে দাও
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() =>
        // সব fail — index.html দাও (SPA হলে)
        caches.match('./index.html')
      );
    })
  );
});
