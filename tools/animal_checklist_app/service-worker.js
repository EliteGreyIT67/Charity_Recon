self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('animal-checklist-cache-v2').then(cache => { // v2 to ensure update
      return cache.addAll([
        '/',
        './index.html',
        './styles.css'
        // The main script is inline in index.html, so it's cached automatically with it.
      ]);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      // Return cached response or fetch from network
      return response || fetch(event.request);
    })
  );
});