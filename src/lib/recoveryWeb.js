/**
 * Detecta en WEB que el usuario acaba de llegar del enlace de "restablecer
 * contraseña", sin depender del evento PASSWORD_RECOVERY.
 *
 * El problema real (5/9/2026): con flowType 'pkce' el enlace vuelve como
 * `?code=...` y supabase-js lo canjea al IMPORTAR el módulo, antes de que React
 * monte el AuthProvider. Cuando AuthContext se suscribe con onAuthStateChange,
 * el evento PASSWORD_RECOVERY ya ha pasado, así que nunca se mostraba el
 * formulario: el usuario entraba directo a su cuenta con la contraseña vieja
 * todavía puesta.
 *
 * Móvil y escritorio no lo sufren porque allí el canje es manual y se distingue
 * con una marca en localStorage (ver googleAuth.js). Aquí se usa ESA MISMA
 * marca, para que no haya dos mecanismos que mantener.
 */

// Se lee ANTES de que nadie toque la URL: supabase-js la limpia al canjear el
// código, y LoginPage además hace replaceState del hash.
export const URL_DE_ENTRADA = typeof window !== 'undefined' ? window.location.href : ''

const MARCA = 'studyai_recovery_pending_at'
const TTL_MS = 60 * 60 * 1000   // los enlaces de Supabase caducan a la hora

/** La deja LoginPage al pedir el correo de restablecimiento (rama web). */
export function marcarRecuperacionPendiente() {
  try { localStorage.setItem(MARCA, String(Date.now())) } catch { /* modo privado */ }
}

/**
 * Error devuelto por Supabase al volver de un enlace, o null si no lo hay.
 * Con PKCE llega en la QUERY (?error=...); en el flujo antiguo, en el hash.
 * Se miran los dos: un enlace ya usado o caducado dejaba al usuario en el
 * login sin ninguna explicación.
 */
export function errorDeEnlace(url) {
  if (!url) return null
  const trozos = []
  const q = url.indexOf('?')
  if (q !== -1) trozos.push(url.slice(q + 1).split('#')[0])
  const h = url.indexOf('#')
  // Bajo HashRouter el hash es la ruta ("#/login"), no un callback.
  if (h !== -1 && !url.slice(h).startsWith('#/')) trozos.push(url.slice(h + 1))

  for (const t of trozos) {
    const p = new URLSearchParams(t)
    const codigo = p.get('error_code')
    if (codigo === 'otp_expired' || codigo === 'otp_disabled') return 'caducado'
    if (p.get('error')) return 'invalido'
  }
  return null
}

/** Decisión pura, para poder probarla sin navegador. */
export function esVueltaDeRecuperacion(url, marcaMs, ahoraMs) {
  if (!url || !marcaMs) return false
  if (ahoraMs - marcaMs > TTL_MS) return false          // marca caducada
  if (errorDeEnlace(url)) return false                   // el enlace ya no valía
  return url.includes('code=')                           // volvemos de un enlace
}

/**
 * ¿Toca pedir contraseña nueva? Consume la marca: un enlace, un uso.
 * Se llama una sola vez al arrancar la app.
 */
export function consumirVueltaDeRecuperacion() {
  let marca = 0
  try {
    marca = Number(localStorage.getItem(MARCA) || 0)
    if (marca) localStorage.removeItem(MARCA)
  } catch { /* modo privado */ }
  return esVueltaDeRecuperacion(URL_DE_ENTRADA, marca, Date.now())
}
