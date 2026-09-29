const CACHE = 'conebel-app-v4';
const ARQUIVOS = ['app.html', 'Logo_Site.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)));
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
  // API sempre direto da rede, sem passar pelo SW v4
  if (url.includes('/pacote') || url.includes('/login') || url.includes('/enviar-email') ||
      url.includes('/upload') || url.includes('/delete') || url.includes('/fotos')) return;
  // REDE PRIMEIRO para todo o resto (site, app, CSVs, js, css, fotos):
  // garante dado atualizado sempre que ha conexao; cache serve apenas offline
  e.respondWith(
    fetch(e.request).then(resp => {
      const copia = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copia));
      return resp;
    }).catch(() => caches.match(e.request))
  );
});
