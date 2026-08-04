/**
 * Login con Google en apps nativas (Electron + Capacitor)
 * ========================================================
 * En web, Supabase redirige dentro del propio navegador (ver LoginPage.jsx).
 * En apps nativas no hay una URL del sitio a la que volver, así que el flujo es:
 *   1. Pedimos a Supabase la URL de Google sin que intente redirigir él mismo.
 *   2. Abrimos esa URL en el navegador del sistema (no dentro de la app).
 *   3. Al terminar, Google/Supabase redirige a un enlace propio (mystudyai://auth-callback)
 *      que el sistema operativo entrega de vuelta a la app (Android: intent-filter,
 *      Windows: protocolo registrado por el instalador).
 *   4. Esa URL trae el token en el fragmento (#access_token=...) — lo usamos para
 *      abrir sesión con supabase.auth.setSession().
 */
import { supabase } from './supabase'

export const NATIVE_OAUTH_REDIRECT = 'mystudyai://auth-callback'

// Marca de "hay un login en curso iniciado por esta misma app", para no
// aceptar un callback que nadie pidió (un enlace mystudyai://auth-callback
// puede llegar de cualquier página o app instalada, ver deep links). Junto
// con PKCE (ver supabase.js) es lo que impide instalar una sesión ajena:
// aunque alguien construya la URL con un "code" válido de OTRA cuenta, esta
// app no tiene el verificador PKCE que generó ese code, así que el
// intercambio falla igualmente -- esta marca solo evita intentarlo siquiera.
const PENDING_KEY = 'studyai_oauth_pending_at'
const PENDING_TTL_MS = 10 * 60 * 1000  // margen para que el usuario complete el login en el navegador externo

// Restablecer contraseña en apps nativas. El enlace del email TIENE que volver a
// la app (mystudyai://auth-callback) y no a la web: con PKCE, el código del enlace
// solo se puede canjear donde se guardó el verificador, que es el almacenamiento
// de ESTA app. Si el enlace abre el navegador del móvil (lo que pasaba antes), el
// canje falla en silencio y el usuario acaba viendo la landing en vez del
// formulario de contraseña nueva.
const RECOVERY_KEY = 'studyai_recovery_pending_at'
const RECOVERY_TTL_MS = 60 * 60 * 1000  // los enlaces de Supabase caducan a la hora

export async function getGoogleOAuthUrl() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: NATIVE_OAUTH_REDIRECT, skipBrowserRedirect: true },
  })
  if (error) throw error
  localStorage.setItem(PENDING_KEY, String(Date.now()))
  return data.url
}

/** Pide el email de restablecimiento desde una app nativa (móvil o escritorio). */
export async function startNativePasswordRecovery(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: NATIVE_OAUTH_REDIRECT,
  })
  if (error) throw error
  localStorage.setItem(RECOVERY_KEY, String(Date.now()))
}

/**
 * Procesa la URL de vuelta (mystudyai://auth-callback?code=...), que puede venir
 * de un login con Google o de un restablecimiento de contraseña — llegan igual,
 * así que se distinguen por la marca que dejó la app al iniciar cada flujo.
 * Devuelve { ok, isRecovery }.
 */
export async function completeNativeAuthFromUrl(url) {
  if (!url || !url.startsWith(NATIVE_OAUTH_REDIRECT)) return { ok: false, isRecovery: false }

  // Un solo uso: se borran tanto si el callback es válido como si no.
  const oauthAt = Number(localStorage.getItem(PENDING_KEY) || 0)
  const recoveryAt = Number(localStorage.getItem(RECOVERY_KEY) || 0)
  localStorage.removeItem(PENDING_KEY)
  localStorage.removeItem(RECOVERY_KEY)

  const now = Date.now()
  const isRecovery = !!recoveryAt && now - recoveryAt <= RECOVERY_TTL_MS
  const isOAuth = !!oauthAt && now - oauthAt <= PENDING_TTL_MS
  // Si por lo que sea hubiera las dos marcas, manda la de recuperación: es más
  // seguro acabar pidiendo contraseña nueva que dar por bueno un login.
  if (!isRecovery && !isOAuth) return { ok: false, isRecovery: false }

  const queryIndex = url.indexOf('?')
  if (queryIndex === -1) return { ok: false, isRecovery }
  const params = new URLSearchParams(url.slice(queryIndex + 1).split('#')[0])
  const code = params.get('code')
  if (!code) return { ok: false, isRecovery }
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) throw error
  return { ok: true, isRecovery }
}

/** Compatibilidad: sigue devolviendo solo el booleano de "se pudo o no". */
export async function completeGoogleOAuthFromUrl(url) {
  const { ok } = await completeNativeAuthFromUrl(url)
  return ok
}
