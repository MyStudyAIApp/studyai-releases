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

/** Decisión pura, para poder probarla sin navegador. */
export function esVueltaDeRecuperacion(url, marcaMs, ahoraMs) {
  if (!url || !marcaMs) return false
  if (ahoraMs - marcaMs > TTL_MS) return false          // marca caducada
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
