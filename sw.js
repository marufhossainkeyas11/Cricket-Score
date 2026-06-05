// ═══════════════════════════════════════════════════════════════
//  CRICKET SCORE — Service Worker  (sw.js)
//  Strategy:
//    • Shell (HTML/CSS/JS/icons) → Cache-First + background refresh
//    • Media (images/video/audio) → Cache-First, lazy populate
//    • External requests          → Network-First with offline fallback
//    • Version bump = CACHE_VER only. No manual ASSETS list needed.
// ═══════════════════════════════════════════════════════════════

const CACHE_VER   = 'v2.2.8';   
const SHELL_KEY   = `cs-shell-${CACHE_VER}`;
const MEDIA_KEY   = `cs-media-${CACHE_VER}`;
const FONT_KEY    = `cs-fonts-${CACHE_VER}`;

// ── পুরনো cache prefix (এই prefix গুলো আর রাখব না) ──────────
const OUR_PREFIXES = ['cs-shell-', 'cs-media-', 'cs-fonts-', 'criclive-'];

// ── Shell: এগুলো install-এ precache হবে ─────────────────────
const SHELL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './logo.png',
  // icons — থাকলে নিচে যোগ করো
  // './icons/icon-192.png',
  // './icons/icon-512.png',
];

// ── File type buckets ────────────────────────────────────────
const MEDIA_EXT   = /\.(mp4|webm|ogv|ogg|mp3|wav|jpg|jpeg|png|gif|webp|svg|ico)(\?.*)?$/i;
const FONT_EXT    = /\.(woff2?|ttf|otf|eot)(\?.*)?$/i;
const SHELL_EXT   = /\.(html|css|js|json|txt|xml)(\?.*)?$/i;

// ════════════════════════════════════════════════════════════
//  INSTALL — precache shell only (fast + reliable)
// ════════════════════════════════════════════════════════════
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_KEY)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => {
        console.log(`[SW] Installed ${CACHE_VER}`);
        return self.skipWaiting();   // নতুন SW তুরন্ত activate হোক
      })
      .catch(err => console.error('[SW] Install failed:', err))
  );
});

// ════════════════════════════════════════════════════════════
//  ACTIVATE — পুরনো cache মুছে নতুন নাও
// ════════════════════════════════════════════════════════════
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      const deletions = keys
        .filter(k => {
          const ours = OUR_PREFIXES.some(p => k.startsWith(p));
          const old  = k !== SHELL_KEY && k !== MEDIA_KEY && k !== FONT_KEY;
          return ours && old;
        })
        .map(k => {
          console.log(`[SW] Deleting old cache: ${k}`);
          return caches.delete(k);
        });
      return Promise.all(deletions);
    }).then(() => {
      console.log(`[SW] Activated ${CACHE_VER}`);
      return self.clients.claim();  // খোলা tabs কে সঙ্গে সঙ্গে নিয়ন্ত্রণ নাও
    })
  );
});

// ════════════════════════════════════════════════════════════
//  MESSAGE — client থেকে command নিতে পারি
// ════════════════════════════════════════════════════════════
self.addEventListener('message', event => {
  if (event.data?.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: CACHE_VER });
  }
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ════════════════════════════════════════════════════════════
//  FETCH — intelligent routing
// ════════════════════════════════════════════════════════════
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // GET ছাড়া কিছু handle করব না
  if (req.method !== 'GET') {
  // Umami tracking POST pass through করো
  if (req.url.includes('umami') || req.url.includes('/api/send')) return;
  return;
  }

  // ── বাইরের origin (CDN, API, fonts.googleapis.com) ─────
  if (url.origin !== self.location.origin) {
    event.respondWith(networkFirstExternal(req));
    return;
  }

  // ── Media files (video/image/audio) ────────────────────
  if (MEDIA_EXT.test(url.pathname)) {
    event.respondWith(cacheFirstLazy(req, MEDIA_KEY));
    return;
  }

  // ── Web fonts ───────────────────────────────────────────
  if (FONT_EXT.test(url.pathname)) {
    event.respondWith(cacheFirstLazy(req, FONT_KEY));
    return;
  }

  // ── Shell: HTML/CSS/JS/JSON ─────────────────────────────
  if (SHELL_EXT.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('/')) {
    event.respondWith(cacheFirstWithRefresh(req));
    return;
  }

  // ── বাকি সব — stale-while-revalidate ───────────────────
  event.respondWith(cacheFirstLazy(req, SHELL_KEY));
});

// ════════════════════════════════════════════════════════════
//  STRATEGIES
// ════════════════════════════════════════════════════════════

/**
 * Cache-First + background revalidate (shell assets)
 * Cache থেকে দাও, পেছনে নেটওয়ার্ক থেকে update করো
 */
async function cacheFirstWithRefresh(req) {
  const cached = await caches.match(req);

  const networkFetch = fetch(req)
    .then(async res => {
      if (res.ok) {
        const cache = await caches.open(SHELL_KEY);
        await cache.put(req, res.clone());
      }
      return res;
    })
    .catch(() => null);

  return cached || await networkFetch || offlineFallback(req);
}

/**
 * Cache-First + lazy populate (media / fonts)
 * Cache এ থাকলে দাও, না থাকলে নেটওয়ার্ক থেকে এনে cache এ রাখো
 */
async function cacheFirstLazy(req, cacheKey) {
  const cached = await caches.match(req);
  if (cached) return cached;

  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(cacheKey);
      cache.put(req, res.clone());   // async, response কে block করে না
    }
    return res;
  } catch {
    return offlineFallback(req);
  }
}

/**
 * Network-First (external: API / CDN)
 * নেটওয়ার্ক চাইবে, না পেলে cache দেবে
 */
async function networkFirstExternal(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      // CDN font/image হলে cache করে রাখো
      if (FONT_EXT.test(req.url) || MEDIA_EXT.test(req.url)) {
        const cache = await caches.open(MEDIA_KEY);
        cache.put(req, res.clone());
      }
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    // JSON API offline fallback
    if (req.headers.get('accept')?.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'offline' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('', { status: 503 });
  }
}

/**
 * সর্বশেষ fallback — index.html দাও (SPA navigation)
 */
async function offlineFallback(req) {
  const cached = await caches.match('./index.html') || await caches.match('./');
  return cached || new Response('<h2>Offline</h2>', {
    headers: { 'Content-Type': 'text/html' },
  });
}
