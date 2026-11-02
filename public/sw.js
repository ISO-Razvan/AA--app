// Service worker — face aplicația instalabilă (PWA) și, fără internet, arată
// pagina offline.html în loc de eroarea browserului. NU păstrează în cache
// aplicația sau datele: totul vine mereu de pe server, deci o versiune nouă
// publicată se vede la următoarea deschidere, fără reinstalare.
// La o schimbare a paginii offline, crește numărul din CACHE.
// Adresa e „/offline", fără .html: Cloudflare redirecționează /offline.html
// către /offline, iar un răspuns redirecționat nu poate fi servit la
// deschiderea unei pagini.
const CACHE = 'aa-lab-offline-v2'
const PAGINA_OFFLINE = '/offline'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(PAGINA_OFFLINE)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chei) => Promise.all(chei.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  )
})

// Doar deschiderea paginilor (navigare); restul cererilor (fișierele
// aplicației, baza de date, /api) trec neatinse.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(fetch(event.request).catch(() => caches.match(PAGINA_OFFLINE)))
})
