const CACHE_NAME = 'global-news-v3';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json'
];

// Install Event
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    return self.clients.claim();
});

// Fetch Event - Network First Strategy
self.addEventListener('fetch', (e) => {
    // For API calls or critical files, ALWAYS try network first
    if (e.request.url.includes('api.rss2json.com') || e.request.url.includes('script.js') || e.request.url.includes('style.css')) {
        e.respondWith(
            fetch(e.request)
                .then((res) => {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, clone);
                    });
                    return res;
                })
                .catch(() => caches.match(e.request)) // Fallback to cache if offline
        );
    } else {
        // For static assets like icons/manifest, try cache first
        e.respondWith(
            caches.match(e.request).then((cachedRes) => {
                return cachedRes || fetch(e.request);
            })
        );
    }
});
