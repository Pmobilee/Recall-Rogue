/**
 * Terra Gacha Service Worker — Phase 39.1
 *
 * Strategy:
 *  - Network-first for /api/ requests (offline fallback from cache).
 *  - Cache-first for hashed assets (immutable — content hash in filename).
 *  - Stale-while-revalidate for images/sprites (instant load, eventual freshness).
 *  - Network-first for navigation (offline fallback to /offline.html).
 *  - Network-first for everything else (cache fallback).
 *  - Cache trimmed to 200 entries max on activate.
 */

const CACHE_VERSION = '__SW_VERSION__'
const CACHE_NAME = `terra-gacha-${CACHE_VERSION}`
const OFFLINE_URL = '/offline.html'

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/facts.db',
  '/sql-wasm.wasm',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192-maskable.png',
  '/icons/icon-512-maskable.png',
]

// ── Asset classification helpers ─────────────────────────────────────────────

// Hashed assets (contain content hash in filename) — cache-first, immutable.
// Example: assets/index-BekwAk96.js, assets/style-Xf3kL9m2.css
const isHashedAsset = (url) => /\/assets\/[^/]+-[a-zA-Z0-9]{8,}\.(js|css|wasm)$/.test(url.pathname)

// Image/sprite assets — stale-while-revalidate (serve cached, update in background).
// These may be updated between deploys without filename changes.
const isImageAsset = (url) => /\.(png|webp|jpg|svg|ico)$/.test(url.pathname)

// ── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
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
    ).then(async () => {
      // Trim cache to 200 entries max (oldest first)
      const cache = await caches.open(CACHE_NAME)
      const allKeys = await cache.keys()
      if (allKeys.length > 200) {
        const toDelete = allKeys.slice(0, allKeys.length - 200)
        await Promise.all(toDelete.map((k) => cache.delete(k)))
      }
    })
  )
  self.clients.claim()
})

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // ── 1. Network-first for API calls ──────────────────────────────────────
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // ── 2. Cache-first for hashed assets (immutable) ──────────────────────
  // Filenames like assets/index-BekwAk96.js contain a content hash.
  // If the content changes, the hash changes, so a cached copy is always valid.
  if (isHashedAsset(url)) {
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
    return
  }

  // ── 3. Stale-while-revalidate for images/sprites ──────────────────────
  // Serve from cache instantly for fast paints, but fetch a fresh copy in
  // the background so the next load picks up any updated artwork.
  if (isImageAsset(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone())
            }
            return response
          }).catch(() => cached)

          return cached || fetchPromise
        })
      })
    )
    return
  }

  // ── 4. Network-first for navigation requests ─────────────────────────
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(OFFLINE_URL))
    )
    return
  }

  // ── 5. Network-first for everything else ──────────────────────────────
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request).then((cached) => {
        return cached || new Response('', { status: 408, statusText: 'Offline' })
      }))
  )
})
