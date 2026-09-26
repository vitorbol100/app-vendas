const CACHE = 'conebel-app-v1';
const ARQUIVOS = ['app.html', 'Logo_Site.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (url.includes('/pacote') || url.includes('/login') || url.includes('/enviar-email')) return;
  e.respondWith(
    caches.match(e.request).then(encontrado => encontrado || fetch(e.request).then(resp => {
      const copia = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copia));
      return resp;
    }).catch(() => caches.match('app.html')))
  );
});