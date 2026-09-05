/** Comprobación de la detección de "vuelta del enlace de contraseña" en web.
 *  Ejecutar: node src/lib/recoveryWeb.test.mjs
 *
 *  El fallo real (5/9/2026): el usuario pulsaba el enlace del correo y entraba
 *  en su cuenta SIN que le pidieran contraseña nueva.
 */
import assert from 'node:assert'

// Copia de la función pura (el módulo lee window al importarse).
const TTL_MS = 60 * 60 * 1000
function errorDeEnlace(url) {
  if (!url) return null
  const trozos = []
  const q = url.indexOf('?')
  if (q !== -1) trozos.push(url.slice(q + 1).split('#')[0])
  const h = url.indexOf('#')
  if (h !== -1 && !url.slice(h).startsWith('#/')) trozos.push(url.slice(h + 1))
  for (const t of trozos) {
    const p = new URLSearchParams(t)
    const codigo = p.get('error_code')
    if (codigo === 'otp_expired' || codigo === 'otp_disabled') return 'caducado'
    if (p.get('error')) return 'invalido'
  }
  return null
}
function esVueltaDeRecuperacion(url, marcaMs, ahoraMs) {
  if (!url || !marcaMs) return false
  if (ahoraMs - marcaMs > TTL_MS) return false
  if (errorDeEnlace(url)) return false
  return url.includes('code=')
}

const ahora = 1_700_000_000_000
const haceUnMinuto = ahora - 60_000
const haceDosHoras = ahora - 2 * 60 * 60 * 1000

// El caso que fallaba: vuelve con ?code= y la marca es reciente.
assert.equal(esVueltaDeRecuperacion('https://mystudyai.eu/?code=abc123', haceUnMinuto, ahora), true)

// Entrar normal a la web no debe pedir contraseña nueva aunque haya marca.
assert.equal(esVueltaDeRecuperacion('https://mystudyai.eu/#/home', haceUnMinuto, ahora), false)

// Sin marca no hay recuperación: un ?code= suelto puede ser otro flujo.
assert.equal(esVueltaDeRecuperacion('https://mystudyai.eu/?code=abc123', 0, ahora), false)

// Marca vieja: el enlace de Supabase ya habría caducado.
assert.equal(esVueltaDeRecuperacion('https://mystudyai.eu/?code=abc123', haceDosHoras, ahora), false)

// Sin URL (SSR o entorno raro) no se decide nada.
assert.equal(esVueltaDeRecuperacion('', haceUnMinuto, ahora), false)

// El enlace ya usado o caducado: hay que AVISAR, no mandar al formulario.
assert.equal(errorDeEnlace('https://mystudyai.eu/?error=access_denied&error_code=otp_expired'), 'caducado')
assert.equal(errorDeEnlace('https://mystudyai.eu/#error=access_denied&error_code=otp_expired'), 'caducado')
assert.equal(errorDeEnlace('https://mystudyai.eu/?error=server_error'), 'invalido')

// Una ruta normal del HashRouter NO es un callback con error.
assert.equal(errorDeEnlace('https://mystudyai.eu/#/terminos'), null)
assert.equal(errorDeEnlace('https://mystudyai.eu/'), null)

// Y con error, aunque haya marca y code, no se muestra el formulario.
assert.equal(
  esVueltaDeRecuperacion('https://mystudyai.eu/?code=abc&error=access_denied&error_code=otp_expired', haceUnMinuto, ahora),
  false)

console.log('OK')
