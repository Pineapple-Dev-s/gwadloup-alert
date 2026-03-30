var CACHE_NAME = 'gwadloup-v10';
var STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/map.js',
  '/js/reports.js',
  '/js/ui.js',
  '/js/imageUpload.js',
  '/js/badges.js',
  '/js/share.js',
  '/js/polls.js',
  '/js/pwa.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);

  // API calls: network first
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(function() {
        return new Response(JSON.stringify({ error: 'Hors ligne' }), { headers: { 'Content-Type': 'application/json' } });
      })
    );
    return;
  }

  // Supabase / external: network only
  if (url.origin !== location.origin) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Static: cache first, network fallback
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) {
        // Update cache in background
        fetch(e.request).then(function(response) {
          if (response.ok) {
            caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, response); });
          }
        }).catch(function() {});
        return cached;
      }
      return fetch(e.request).then(function(response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone); });
        }
        return response;
      }).catch(function() {
        if (e.request.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});
