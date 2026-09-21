const CACHE_NAME = 'ee-smart-course-pwa-v33';
const APP_SHELL = [
  './',
  './index.html',
  './engineering-design-tool.html',
  './classroom.css',
  './tokens.css',
  './fonts/inter-400.woff2',
  './fonts/inter-500.woff2',
  './fonts/inter-600.woff2',
  './fonts/inter-700.woff2',
  './course-data.js',
  './course-core.js',
  './course-figures.js',
  './course-knowledge.js',
  './course-graph.js',
  './classroom.js',
  './ms14-decoder.js',
  './course-file-analyzer.js',
  './course-file-ui.js',
  './classroom-v2.js',
  './v2.css',
  './v2-teacher.css',
  './manifest.webmanifest',
  './icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('./engineering-design-tool.html')))
  );
});
