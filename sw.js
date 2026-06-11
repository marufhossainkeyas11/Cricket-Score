const CACHE_VER  = 'v2.4.7';
const SHELL_KEY  = `cs-shell-${CACHE_VER}`;
const MEDIA_KEY  = `cs-media-${CACHE_VER}`;
const FONT_KEY   = `cs-fonts-${CACHE_VER}`;
const PREFIXES   = ['cs-shell-', 'cs-media-', 'cs-fonts-', 'criclive-'];

const SHELL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './live.js',
  './manifest.json',
  './logo.png',
  './pwmlogo.svg',
  './favicon.ico',
  './favicon.svg',
  './favicon-96x96.png',
  './apple-touch-icon.png',
  './web-app-manifest-192x192.png',
  './web-app-manifest-512x512.png',
];

const RX_MEDIA  = /\.(mp4|webm|ogv|ogg|mp3|wav|jpg|jpeg|png|gif|webp|svg|ico)(\?.*)?$/i;
const RX_FONT   = /\.(woff2?|ttf|otf|eot)(\?.*)?$/i;
const RX_SHELL  = /\.(html|css|js|json|txt|xml)(\?.*)?$/i;


self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_KEY)
      .then(c => c.addAll(SHELL_ASSETS))
      .catch(err => console.error('[SW] Install failed:', err))
  );
});


self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => PREFIXES.some(p => k.startsWith(p)) && ![SHELL_KEY, MEDIA_KEY, FONT_KEY].includes(k))
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});


self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION')  event.ports[0]?.postMessage({ version: CACHE_VER });
});


self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  if (url.origin !== self.location.origin) {
    event.respondWith(networkFirstExternal(req));
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(navigationHandler(req));
    return;
  }

  if (RX_MEDIA.test(url.pathname)) {
    event.respondWith(cacheFirstLazy(req, MEDIA_KEY));
    return;
  }

  if (RX_FONT.test(url.pathname)) {
    event.respondWith(cacheFirstLazy(req, FONT_KEY));
    return;
  }

  if (RX_SHELL.test(url.pathname)) {
    event.respondWith(cacheFirstRefresh(req));
    return;
  }

  event.respondWith(cacheFirstLazy(req, SHELL_KEY));
});


async function navigationHandler(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(SHELL_KEY);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cached =
      await caches.match(req) ||
      await caches.match('./index.html') ||
      await caches.match('./');
    return cached || new Response('<h2>Offline</h2>', { headers: { 'Content-Type': 'text/html' } });
  }
}

async function cacheFirstRefresh(req) {
  const cache = await caches.open(SHELL_KEY);
  const cached = await cache.match(req);
  
  fetch(req).then(async res => {
    if (res.ok) cache.put(req, res.clone());
  }).catch(() => {});
  
  return cached || await fetch(req).catch(() => offlineFallback(req));
}

async function cacheFirstLazy(req, key) {
  const cache = await caches.open(key);
  const cached = await cache.match(req);
  if (cached) return cached;

  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(key);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    return offlineFallback(req);
  }
}

async function networkFirstExternal(req) {
  try {
    const res = await fetch(req);
    if (res.ok && (RX_FONT.test(req.url) || RX_MEDIA.test(req.url))) {
      const cache = await caches.open(MEDIA_KEY);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    if (req.headers.get('accept')?.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'offline' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('', { status: 503 });
  }
}

async function offlineFallback(req) {
  const cache = await caches.open(SHELL_KEY);
  const cached = await cache.match('./index.html') || await cache.match('./');
  return cached || new Response('<h2>Offline</h2>', { headers: { 'Content-Type': 'text/html' } });
}
