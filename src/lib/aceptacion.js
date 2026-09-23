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

// Versión de Condiciones y Privacidad que acepta el usuario. Cambiarla cuando
// cambien los textos legales, para saber quién aceptó cuál.
export const TERMS_VERSION = '2026-09-24'

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
  try { pendiente = !!localStorage.getItem(CLAVE) } catch {}
  if (!pendiente) return

  try {
    const { data } = await supabase
      .from('profiles')
      .select('terms_accepted_at, age_declared_at')
      .eq('id', userId)
      .maybeSingle()

    const ahora = new Date().toISOString()
    const campos = {}
    if (data && !data.terms_accepted_at) {
      campos.terms_accepted_at = ahora
      campos.terms_version = TERMS_VERSION
    }
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

/**
 * Desde cuándo se exige constancia de la aceptación.
 *
 * Por qué una fecha fija y no "creada hace menos de X minutos": el alta con
 * Google no avisa de si creó la cuenta o solo inició sesión, así que hay que
 * deducirlo. La primera versión de esto miraba si la cuenta había nacido
 * hacía menos de 10 minutos, y tenía un agujero que se vio probando: quien
 * rechazaba la aceptación y volvía a entrar 11 minutos después pasaba
 * derecho, sin aceptar nada y sin dejar constancia. Con una fecha fija el
 * bloqueo no caduca: o acepta, o no entra, hoy y dentro de un año.
 *
 * Las cuentas anteriores a esta fecha se quedan fuera a propósito (decisión
 * del usuario, 19/9/2026): son de antes de que existiera el mecanismo y no
 * se les planta una pantalla legal por sorpresa.
 */
export const EXIGIBLE_DESDE = Date.parse('2026-09-19T00:00:00Z')

export function requiereConstancia(createdAt) {
  if (!createdAt) return false
  const nacimiento = new Date(createdAt).getTime()
  if (Number.isNaN(nacimiento)) return false
  return nacimiento >= EXIGIBLE_DESDE
}

/**
 * ¿Hay que pararle los pies a este usuario y pedirle la aceptacion?
 *
 * Solo a las cuentas recien creadas: a los usuarios de siempre no se les
 * molesta, aunque no tengan constancia por ser anteriores a este mecanismo.
 * Ante cualquier fallo devuelve false — un error de red no puede dejar a
 * nadie fuera de su cuenta.
 */
export async function necesitaAceptacion(user) {
  if (!user?.id) return false
  if (!requiereConstancia(user.created_at)) return false
  try {
    const { data } = await supabase
      .from('profiles')
      .select('terms_accepted_at')
      .eq('id', user.id)
      .maybeSingle()
    return !!data && !data.terms_accepted_at
  } catch {
    return false
  }
}

/** Escribe la constancia cuando el usuario acepta en la pantalla de aviso. */
export async function guardarAceptacion(userId) {
  if (!userId) throw new Error('sin usuario')
  const ahora = new Date().toISOString()
  const { error } = await supabase
    .from('profiles')
    .update({
      terms_accepted_at: ahora, age_declared_at: ahora, terms_version: TERMS_VERSION,
    })
    .eq('id', userId)
  if (error) throw error
  try { localStorage.removeItem(CLAVE) } catch {}
}
