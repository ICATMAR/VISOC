// App-shell cache for the installed Buoys app. Live data (ERDDAP, Puertos,
// Open-Meteo, all through api.icatmar.cat) is cross-origin and intentionally
// left alone here.
//
// Network first, cache as fallback - unlike boiasomorrostro/wind's cache first:
// this app is in beta and changes often, so a user should get the new version
// on the next load rather than the one after. Everything same-origin the app
// loads (its own files, and VISOC's scripts, styles and images under ../) is
// cached on the way past, so the app still opens offline once it has been
// opened online.
const CACHE_NAME = 'buoys-shell-v1';
const SHELL_URLS = [
  './',
  './index.html',
  './main.js',
  './styles.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
  );
});
