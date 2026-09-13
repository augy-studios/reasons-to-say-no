/* Service worker. Bump VERSION on every deploy that changes anything this
   worker serves: the browser compares this file byte for byte, and an
   unchanged file means no update is ever offered to anybody. */

const VERSION = "5";
const CACHE = `justsayno-v${VERSION}`;

const ASSETS = [
  "/",
  "/index.html",
  "/css/theme.css",
  "/style.css",
  "/js/icons.js",
  "/js/ui.js",
  "/js/theme.js",
  "/js/sw-update.js",
  "/script.js",
  "/stats",
  "/stats.html",
  "/stats.css",
  "/stats.js",
  "/RTSN-main.png",
  "/RTSN-192.png",
  "/RTSN-512.png",
  "/favicon.ico",
  "/manifest.json"
];

/* -- Install: cache shell, then wait --
   No skipWaiting() here. The new worker downloads, installs, and waits until
   somebody presses Reload on the update bar. Promoting it silently would
   leave the open page running old JavaScript against new cached assets. */

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
    .then(cache => cache.addAll(ASSETS))
  );
});

/* -- Activate: clean old caches --
   No clients.claim() here either. The page that accepted the update is
   claimed from the message handler below, and any other page picks up the
   new worker on its next navigation. */

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
    .then(keys =>
      Promise.all(
        keys
        .filter(k => k !== CACHE)
        .map(k => caches.delete(k))
      )
    )
  );
});

/* -- Message: the only place a waiting worker is promoted -- */

self.addEventListener('message', event => {
  const type = typeof event.data === 'string' ? event.data : event.data?.type;

  if (type === 'skip-waiting') {
    event.waitUntil(self.skipWaiting().then(() => self.clients.claim()));
  }
});

/* -- Fetch: strategy per route -- */

self.addEventListener('fetch', event => {
  const {
    request
  } = event;
  const url = new URL(request.url);

  // API - network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Google Fonts - cache-first (immutable)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // static assets - cache-first
  event.respondWith(cacheFirst(request));
});

/* -- Strategies -- */

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'You appear to be offline.'
      }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json'
        },
      }
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // offline - fallback for navigation
    if (request.mode === 'navigate') {
      return caches.match('/index.html');
    }
    return new Response('Offline', {
      status: 503
    });
  }
}
