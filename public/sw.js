/**
 * Terra Gacha Service Worker
 *
 * Strategy:
 *  - Network-first for all /api/ requests (fall back to cache if offline).
 *  - Cache-first for all static assets (HTML, JS, CSS, DB, images).
 *
 * On install:  pre-caches the shell URLs listed in PRECACHE_URLS.
 * On activate: removes stale caches from previous SW versions.
 * On fetch:    serves from cache or network per the strategy above.
 */

const CACHE_NAME = 'terra-gacha-v1'

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/facts.db',
]

// ── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  // Skip the waiting phase so the new SW activates immediately
  self.skipWaiting()
})

// ── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  )
  // Take control of all clients immediately
  self.clients.claim()
})

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only handle GET requests — let non-GET pass through unmodified
  if (request.method !== 'GET') return

  if (request.url.includes('/api/')) {
    // ── Network-first for API calls ──────────────────────────────────────────
    // Try the network; if it fails (offline), serve the cached response.
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh response for future offline use
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request))
    )
  } else {
    // ── Cache-first for static assets ────────────────────────────────────────
    // Serve from cache if available; otherwise fetch from network and cache it.
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
      })
    )
  }
})
