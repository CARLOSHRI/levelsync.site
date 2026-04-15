/**
 * Service Worker - PWA LotoGrana
 * Cache inteligente: network-first para código, cache-first para assets
 * Compatível com deploy em raiz ou subpasta
 */

const CACHE_VERSION = 'loto-grana-v165';
const CACHE_NAME = CACHE_VERSION;

function getBasePath() {
    const path = self.location.pathname;
    return path.substring(0, path.lastIndexOf('/') + 1) || '/';
}

const ASSET_PATHS = [
    'index.html',
    'login.html',
    'styles.css',
    'manifest.json',
    'js/main.js',
    'js/api-client.js',
    'js/core/state.js',
    'js/core/config.js',
    'js/core/navigation.js',
    'js/utils/utils.js',
    'js/utils/storage.js',
    'js/utils/errors.js',
    'js/utils/validators.js',
    'js/utils/loading.js',
    'js/utils/confetti.js',
    'js/utils/api.js',
    'js/utils/hacking-animation.js',
    'js/utils/bet-confirmation-animation.js',
    'js/utils/pwa-install.js',
    'js/utils/push-notifications.js',
    'js/features/betting.js',
    'js/features/ia-expert.js',
    'js/features/mode-modal.js',
    'js/features/quantity-modal.js',
    'js/features/results-checker.js',
    'js/features/pools.js',
    'js/features/quick-games.js',
    'js/wallet/balance.js',
    'js/wallet/deposit.js',
    'js/wallet/withdraw.js',
    'js/ui/toasts.js',
    'js/ui/share.js',
    'js/ui/renders.js',
    'js/ui/hot-cold.js',
    'css/hacking.css',
    'css/bet-confirmation.css',
    'screens/home.html',
    'screens/betting.html',
    'screens/wallet.html',
    'screens/results.html',
    'screens/profile.html',
    'screens/deposit.html',
    'screens/withdraw.html',
    'screens/my-bets.html',
    'screens/pools.html',
    'screens/settings.html',
    'screens/quick-games.html',
    'assets/icon.png',
    'assets/megasena.png',
    'assets/lotofacil.png',
    'assets/quina.png',
    'assets/logo-ia.png',
    'assets/imagem-fundo-card.png'
];

self.addEventListener('install', (event) => {
    const base = getBasePath();
    const urls = ASSET_PATHS.map(p => new URL(p, self.location.origin + base).href);

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urls))
            .then(() => self.skipWaiting())
            .catch((err) => console.warn('[SW] Precache parcial:', err))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('push', (event) => {
    let data = { title: 'Loto Grana', body: 'Nova notificação' };
    try {
        if (event.data) data = event.data.json();
    } catch (_) {}
    event.waitUntil(
        self.registration.showNotification(data.title || 'Loto Grana', {
            body: data.body || '',
            icon: data.icon || '/assets/icon.png',
            tag: data.tag || 'lotograna',
            data: { url: data.url || '/' }
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const c of clientList) {
                if (c.url.includes(self.location.origin) && 'focus' in c) {
                    c.navigate(url);
                    return c.focus();
                }
            }
            if (self.clients.openWindow) return self.clients.openWindow(url);
        })
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (event.request.method !== 'GET') return;

    if (url.pathname.includes('/api/') || url.pathname.includes('/api')) {
        return;
    }

    if (url.origin !== self.location.origin) {
        return;
    }

    const isCodeFile = /\.(js|html|css)(\?|$)/.test(url.pathname);

    if (isCodeFile) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request).then((cached) => {
                        if (cached) return cached;
                        if (event.request.mode === 'navigate') {
                            const base = getBasePath();
                            return caches.match(new URL('index.html', self.location.origin + base).href);
                        }
                        return undefined;
                    });
                })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
            .catch(() => {
                if (event.request.mode === 'navigate') {
                    const base = getBasePath();
                    return caches.match(new URL('index.html', self.location.origin + base).href);
                }
                return undefined;
            })
    );
});
