// La app abre aunque la PC esté apagada o sin internet: red primero (3,5 s) y si no, lo guardado.
// Rutas relativas: sirve igual en la PC (raíz) que en GitHub Pages (subcarpeta).
const VERSION = 'transcriptor-v6';
const ARCHIVOS = [
  './', 'index.html', 'guia.html', 'css/app.css', 'manifest.webmanifest',
  'js/app.js', 'js/modo.js', 'js/ui.js', 'js/iconos.js', 'js/sonidos.js', 'js/fondo.js', 'js/tema.js', 'js/db.js', 'js/sincronizar.js', 'js/online.js', 'js/grabadora.js',
  'js/lib/segmentos.js', 'js/lib/exportar.js', 'js/lib/docx.js', 'js/lib/sincro.js',
  'js/pantallas/lista.js', 'js/pantallas/nueva.js', 'js/pantallas/grabar.js', 'js/pantallas/detalle.js', 'js/pantallas/ajustes.js',
  'fuentes/atkinson.woff2', 'fuentes/source-serif.woff2', 'iconos/icono.svg', 'iconos/192.png', 'iconos/512.png',
];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys()
    .then(claves => Promise.all(claves.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', ev => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  ev.respondWith((async () => {
    try {
      const r = await fetch(ev.request, { signal: AbortSignal.timeout(3500) });
      if (r.ok) (await caches.open(VERSION)).put(ev.request, r.clone());
      return r;
    } catch {
      return (await caches.match(ev.request, { ignoreSearch: true }))
        || (ev.request.mode === 'navigate' ? caches.match('index.html') : Response.error());
    }
  })());
});
