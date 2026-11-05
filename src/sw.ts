/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { clientsClaim } from 'workbox-core'

declare const self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Offline: serve the app shell for any navigation.
try {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))
} catch {
  /* index.html not precached in dev */
}

// Google Fonts: keep a copy so the app looks right offline.
registerRoute(({ url }) => url.origin === 'https://fonts.googleapis.com', new StaleWhileRevalidate({ cacheName: 'google-fonts-css' }))
registerRoute(({ url }) => url.origin === 'https://fonts.gstatic.com', new CacheFirst({ cacheName: 'google-fonts' }))

/**
 * Web Push from the `notify` edge function. Payload:
 * { "title": "...", "body": "...", "tag": "...", "url": "/" }
 */
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; tag?: string; url?: string } = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { body: event.data?.text() }
  }
  event.waitUntil(
    (async () => {
      // The open app already shows an in-app toast for this.
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (windows.some((w) => (w as WindowClient).visibilityState === 'visible' && (w as WindowClient).focused)) return
      await self.registration.showNotification(data.title ?? 'Kitchen Cupboard', {
        body: data.body,
        tag: data.tag,
        icon: '/pwa-192x192.png',
        badge: '/pwa-64x64.png',
        data: { url: data.url ?? '/' },
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data?.url as string) ?? '/'
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = all[0] as WindowClient | undefined
      if (existing) {
        await existing.focus()
        existing.postMessage({ type: 'open', url })
      } else {
        await self.clients.openWindow(url)
      }
    })(),
  )
})
