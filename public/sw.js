const VERSION = 'v3'
const APP_SHELL_CACHE = `bitbrawler-shell-${VERSION}`
const ASSET_CACHE = `bitbrawler-assets-${VERSION}`
const RUNTIME_CACHE = `bitbrawler-runtime-${VERSION}`

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon-120.png',
  '/apple-touch-icon-152.png',
  '/apple-touch-icon-167.png',
  '/apple-touch-icon-180.png',
]

const isAssetRequest = (requestUrl, request) => {
  if (request.destination === 'script') return true
  if (request.destination === 'style') return true
  if (request.destination === 'image') return true
  if (request.destination === 'font') return true
  return requestUrl.pathname.startsWith('/assets/')
}

const staleWhileRevalidate = async (request, cacheName) => {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const networkFetch = fetch(request)
    .then((response) => {
      cache.put(request, response.clone())
      return response
    })
    .catch(() => cached)

  return cached || networkFetch
}

const networkFirst = async (request, cacheName, fallbackUrl) => {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    cache.put(request, response.clone())
    return response
  } catch (error) {
    const cached = await cache.match(request)
    if (cached) return cached
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl)
      if (fallback) return fallback
    }
    throw error
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![APP_SHELL_CACHE, ASSET_CACHE, RUNTIME_CACHE].includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, APP_SHELL_CACHE, '/index.html'))
    return
  }

  if (isAssetRequest(url, request)) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE))
    return
  }

  event.respondWith(networkFirst(request, RUNTIME_CACHE))
})
