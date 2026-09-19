/** ¿A quién hay que pedirle la aceptación al volver de Google?
 *  Ejecutar: node src/lib/aceptacion.test.mjs
 *
 *  Es lo único que separa "pedirle la aceptación a un alta nueva" de
 *  "molestar a quien lleva meses registrado". Si esto se rompe, o se cuelan
 *  altas sin constancia, o se le planta una pantalla legal a todo el mundo.
 *
 *  El caso del rechazo (abajo) es un agujero REAL que tuvo la primera
 *  versión: miraba si la cuenta había nacido hacía menos de 10 minutos, así
 *  que quien decía "no acepto" y volvía a entrar 11 minutos después pasaba
 *  derecho. Lo pilló el usuario probando, no el código.
 */
import assert from 'node:assert'

// Copia de la función pura (el módulo importa supabase al cargarse).
const EXIGIBLE_DESDE = Date.parse('2026-09-19T00:00:00Z')
function requiereConstancia(createdAt) {
  if (!createdAt) return false
  const nacimiento = new Date(createdAt).getTime()
  if (Number.isNaN(nacimiento)) return false
  return nacimiento >= EXIGIBLE_DESDE
}

// Alta nueva: se le pide.
assert.equal(requiereConstancia('2026-09-19T13:42:49Z'), true, 'alta de hoy')
assert.equal(requiereConstancia('2027-03-01T10:00:00Z'), true, 'alta del año que viene')

// EL AGUJERO: rechazó la aceptación y vuelve mucho después. Sigue sin
// constancia, así que se le tiene que volver a pedir — no caduca.
assert.equal(requiereConstancia('2026-09-19T13:42:49Z'), true, 'vuelve tras rechazar')

// Usuarios de siempre: no se les molesta (decisión del usuario, 19/9/2026).
assert.equal(requiereConstancia('2026-06-07T07:46:23Z'), false, 'cuenta de junio')
assert.equal(requiereConstancia('2026-09-18T23:59:59Z'), false, 'cuenta de anoche')

// Datos ausentes o corruptos: no se bloquea a nadie por un campo raro.
assert.equal(requiereConstancia(null), false, 'sin fecha')
assert.equal(requiereConstancia('vete a saber'), false, 'fecha ilegible')

console.log('OK — aceptacion: a quién se le exige constancia')
