const CACHE_NAME = 'pee-tracker-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css'
  // Add other assets you want to cache
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS_TO_CACHE))
            .catch(error => console.error('Cache installation failed:', error))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .catch(error => console.error('Cache activation failed:', error))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                const fetchPromise = fetch(event.request)
                    .then(networkResponse => {
                        // Update cache with new response
                        caches.open(CACHE_NAME)
                            .then(cache => cache.put(event.request, networkResponse.clone()));
                        return networkResponse;
                    })
                    .catch(() => cachedResponse);

                // Return cached response immediately, but fetch new version in background
                return cachedResponse || fetchPromise;
            })
    );
});