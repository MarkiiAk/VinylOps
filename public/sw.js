// Service worker minimo para VinylOps Pricing Studio.
//
// Decision: configuracion manual en vez de next-pwa. next-pwa (ultimo release 5.6.0)
// no tiene soporte confirmado ni mantenimiento activo para Next.js App Router en
// versiones recientes (15/16) ni para Turbopack; su plugin de Webpack puede chocar
// con el pipeline de build de App Router. Un service worker propio, simple, evita
// ese riesgo y da control total sobre la estrategia de cache. Ver ARCHITECTURE.md.
//
// Estrategia:
// - App shell (/, manifest, iconos): cache-first con fallback a red.
// - Todo lo demas (incluye API routes /api/*): network-first, sin cachear respuestas
//   dinamicas (esta app trabaja con datos de inventario/cotizaciones que deben ser
//   siempre frescos).

const CACHE_NAME = "vinylops-shell-v1";
const APP_SHELL = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Nunca cachear llamadas a la API: los datos de inventario/cotizaciones
  // siempre deben venir frescos del servidor.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request)
        .then((response) => {
          if (response.ok && (url.origin === self.location.origin)) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
