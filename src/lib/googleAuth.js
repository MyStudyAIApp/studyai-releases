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

export async function getGoogleOAuthUrl() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: NATIVE_OAUTH_REDIRECT, skipBrowserRedirect: true },
  })
  if (error) throw error
  return data.url
}

/** Procesa la URL de vuelta (mystudyai://auth-callback#access_token=...&refresh_token=...) */
export async function completeGoogleOAuthFromUrl(url) {
  if (!url || !url.startsWith(NATIVE_OAUTH_REDIRECT)) return false
  const hashIndex = url.indexOf('#')
  if (hashIndex === -1) return false
  const params = new URLSearchParams(url.slice(hashIndex + 1))
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  if (!access_token || !refresh_token) return false
  const { error } = await supabase.auth.setSession({ access_token, refresh_token })
  if (error) throw error
  return true
}
