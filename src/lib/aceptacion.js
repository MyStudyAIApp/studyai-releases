/**
 * Constancia de la aceptación de Condiciones y de la declaración de edad.
 *
 * Por qué existe: marcar la casilla en el formulario no dejaba rastro en
 * ningún sitio. Si mañana un padre reclama, no había forma de acreditar qué
 * declaró el usuario ni cuándo (art. 7.1 y 8.2 RGPD, art. 7 LOPDGDD).
 *
 * Cómo funciona: la pantalla de login deja una marca al pulsar, y AuthContext
 * la convierte en fecha en `profiles` la primera vez que hay sesión. Hace
 * falta el rodeo porque el alta con Google se va a otra página y vuelve: el
 * estado de React se pierde por el camino, localStorage no. Se usa localStorage
 * y no sessionStorage porque en el alta por email la sesión llega después de
 * pulsar el enlace de confirmación, que a menudo abre una pestaña nueva.
 */
import { supabase } from './supabase'

const CLAVE = 'studyai_aceptacion_pendiente'

export function marcarAceptacion() {
  try { localStorage.setItem(CLAVE, '1') } catch {}
}

/**
 * Si hay marca pendiente, escribe la fecha en el perfil y la consume.
 * Solo rellena lo que esté vacío: si el usuario ya tenía constancia de una
 * sesión anterior, no se le pisa con la fecha de hoy — la buena es la primera.
 */
export async function registrarAceptacionSiProcede(userId) {
  if (!userId) return
  let pendiente = false
  try { pendiente = localStorage.getItem(CLAVE) === '1' } catch {}
  if (!pendiente) return

  try {
    const { data } = await supabase
      .from('profiles')
      .select('terms_accepted_at, age_declared_at')
      .eq('id', userId)
      .maybeSingle()

    const ahora = new Date().toISOString()
    const campos = {}
    if (data && !data.terms_accepted_at) campos.terms_accepted_at = ahora
    if (data && !data.age_declared_at)   campos.age_declared_at   = ahora

    if (Object.keys(campos).length) {
      await supabase.from('profiles').update(campos).eq('id', userId)
    }
    // Se consume aunque no hubiera nada que escribir: la marca ya cumplió.
    try { localStorage.removeItem(CLAVE) } catch {}
  } catch {
    // Si falla, se deja la marca puesta para reintentarlo en la próxima
    // sesión. Un fallo de red no puede costarle el acceso a nadie.
  }
}
