import { api } from '../store/appStore'

// Ajustes de usuario sincronizados entre plataformas (voz, tema, idioma de
// interfaz, idioma de respuesta de la IA, velocidad de lectura, objetivo
// diario, horas de disponibilidad) — antes cada uno vivía solo en
// localStorage/preferencias del dispositivo, así que cambiar la voz en el
// móvil no se notaba en el escritorio. Ahora también se guardan en el
// perfil de la nube (profiles.settings) y se aplican al iniciar sesión.

let pushTimer = null
let pending = {}

// Empuja a la nube con un pequeño debounce — si el usuario mueve un slider o
// escribe varias veces seguidas, no queremos una petición por cada tecla.
export function pushSettings(partial) {
  pending = { ...pending, ...partial }
  clearTimeout(pushTimer)
  pushTimer = setTimeout(async () => {
    const body = pending
    pending = {}
    try { await api('PUT', '/me/settings', body) } catch { /* se reintentará en el próximo cambio */ }
  }, 800)
}

export async function fetchSettings() {
  try { return await api('GET', '/me/settings') } catch { return {} }
}
