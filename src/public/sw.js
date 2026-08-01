// Service worker minimo — solo gestiona notificaciones push (avisos de examen).
// No cachea nada; la app sigue funcionando con o sin este worker activo.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = { title: 'MyStudy AI', body: 'Tienes una notificación nueva' }
  try {
    if (event.data) data = event.data.json()
  } catch { /* payload no era JSON, usar valores por defecto */ }

  event.waitUntil(
    self.registration.showNotification(data.title || 'MyStudy AI', {
      body: data.body || '',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow('/calendar')
    })
  )
})
