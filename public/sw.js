// Wasakaka — Service Worker (PWA)
// Estrategia (solo producción; en dev el SW no se registra):
// - Páginas y API: network-first (contenido siempre fresco, respaldo offline).
// - Chunks con hash de /_next/static/: cache-first (inmutables por diseño en
//   producción — el nombre cambia si el contenido cambia).
// - Imágenes/íconos: cache-first.
const VERSION = "wasakaka-v3";
const CACHE_ESTATICO = `${VERSION}-static`;
const CACHE_PAGINAS = `${VERSION}-paginas`;

const RECURSOS_BASE = [
  "/",
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/img/hero.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_ESTATICO)
      .then((cache) => cache.addAll(RECURSOS_BASE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // API: siempre red; si falla, responder JSON de offline
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(req).catch(() =>
        new Response(JSON.stringify({ error: "Sin conexión. Reintenta al reconectarte." }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // Imágenes e íconos: cache-first (no cambian seguido)
  if (url.pathname.startsWith("/img/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copia = res.clone();
            caches.open(CACHE_ESTATICO).then((cache) => cache.put(req, copia));
            return res;
          })
      )
    );
    return;
  }

  // JS/CSS de la app: cache-first. SEGURO solo en producción: los chunks llevan
  // hash del contenido en el nombre (inmutables). En dev el SW no se registra,
  // así que nunca servimos código podrido tras un arreglo.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copia = res.clone();
            caches.open(CACHE_ESTATICO).then((cache) => cache.put(req, copia));
            return res;
          })
      )
    );
    return;
  }

  // Páginas: network-first con respaldo offline
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copia = res.clone();
        caches.open(CACHE_PAGINAS).then((cache) => cache.put(req, copia));
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || caches.match("/offline.html"))
      )
  );
});
