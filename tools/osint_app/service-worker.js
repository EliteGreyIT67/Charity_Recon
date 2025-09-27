self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('charity-recon-cache').then(cache => {
      return cache.addAll([
        '/',
        '/tools/osint_app/index.html',
        '/tools/osint_app/icon-512.png'
      ]);
    })
  );
});
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
