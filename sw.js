const C = 'exp-20261004134420';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(['./', 'manifest.webmanifest', 'icons/icon-180.png']))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.hostname.endsWith('google.com') || u.hostname.endsWith('googleusercontent.com')) return;
  if (u.origin === location.origin) {
    // Stale-while-revalidate: mở ngay bản đã lưu, tải bản mới ở nền (lần mở sau sẽ dùng bản mới).
    const net = fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); } return r; });
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || net).catch(() => net));
    e.waitUntil(net.catch(() => {}));
  } else {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; })));
  }
});
