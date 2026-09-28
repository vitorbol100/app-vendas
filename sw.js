const CACHE = 'conebel-app-v3';
const ARQUIVOS = ['app.html', 'Logo_Site.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(chaves =>
      Promise.all(chaves.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (url.includes('/pacote') || url.includes('/login') || url.includes('/enviar-email')) return;
  // app.html: rede primeiro (garante versao nova), cache so se ficar offline
  if (e.request.mode === 'navigate' || url.endsWith('/app.html')) {
    e.respondWith(
      fetch(e.request).then(resp => {
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
        return resp;
      }).catch(() => caches.match('app.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(encontrado => encontrado || fetch(e.request).then(resp => {
      const copia = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copia));
      return resp;
    }).catch(() => caches.match('app.html')))
  );
});
