import { api } from '../store/appStore'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

export async function subscribeToPush() {
  if (!isPushSupported()) throw new Error('Este navegador no soporta notificaciones push')

  // Si ya estaba denegado de antes, el navegador ni siquiera muestra el
  // diálogo de permiso (requestPermission() devuelve 'denied' sin preguntar)
  // -- en un TWA de Android esto casi siempre es la caché de Chrome quedándose
  // con la primera respuesta que vio, sin volver a comprobarlo nunca. Un
  // mensaje genérico deja al usuario sin saber qué hacer, así que aquí se
  // explica el arreglo real en vez de repetir el intento a ciegas.
  if (Notification.permission === 'denied') {
    throw new Error(
      'Las notificaciones están bloqueadas para este sitio. En el móvil: abre Chrome → Ajustes → Almacenamiento → Borrar caché (NO "Borrar datos"), y vuelve a intentarlo. En el ordenador: revisa los permisos del sitio en el navegador.'
    )
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permiso de notificaciones denegado')

  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  const { public_key } = await api('GET', '/push/vapid-public-key')

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key),
    })
  }

  const json = subscription.toJSON()
  await api('POST', '/push/subscribe', { endpoint: json.endpoint, keys: json.keys })
  return subscription
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) return
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) {
    await api('DELETE', '/push/subscribe', { endpoint: subscription.endpoint })
    await subscription.unsubscribe()
  }
}

export async function isPushSubscribed() {
  if (!isPushSupported()) return false
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  return !!subscription
}
