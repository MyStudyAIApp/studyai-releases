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

export async function getGoogleOAuthUrl() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: NATIVE_OAUTH_REDIRECT, skipBrowserRedirect: true },
  })
  if (error) throw error
  localStorage.setItem(PENDING_KEY, String(Date.now()))
  return data.url
}

/** Procesa la URL de vuelta (mystudyai://auth-callback?code=...) */
export async function completeGoogleOAuthFromUrl(url) {
  if (!url || !url.startsWith(NATIVE_OAUTH_REDIRECT)) return false

  // Un solo uso: se borra tanto si el callback es válido como si no.
  const startedAt = Number(localStorage.getItem(PENDING_KEY) || 0)
  localStorage.removeItem(PENDING_KEY)
  if (!startedAt || Date.now() - startedAt > PENDING_TTL_MS) return false

  const queryIndex = url.indexOf('?')
  if (queryIndex === -1) return false
  const params = new URLSearchParams(url.slice(queryIndex + 1).split('#')[0])
  const code = params.get('code')
  if (!code) return false
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) throw error
  return true
}
