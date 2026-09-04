// Requisitos de contraseña del registro — passwordProblem() de LoginPage.jsx.
//
// LoginPage.jsx es JSX y arrastra medio proyecto al importarlo, así que se
// extrae solo la función del fuente y se evalúa. Se prueba el código real, no
// una copia de las expresiones regulares (que es justo donde se cuelan los
// fallos).
//
//     node src/pages/LoginPage.password.test.mjs
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

// Se normalizan los saltos de línea: en Windows el fuente llega con CRLF.
const fuente = readFileSync(new URL('./LoginPage.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const trozo = fuente.match(/export const PASSWORD_MIN[\s\S]*?\n}\n/)
assert.ok(trozo, 'no se encontró passwordProblem en LoginPage.jsx')
// El trozo extraído ya trae sus propios `export`, así que se importa tal cual.
const { PASSWORD_MIN, passwordProblem } = await import(
  'data:text/javascript,' + encodeURIComponent(trozo[0])
)

assert.equal(PASSWORD_MIN, 8)

// --- Las que hay que rechazar ------------------------------------------------
// Los grupos son los mismos que exige Supabase en el servidor (minuscula,
// mayuscula, digito y simbolo, minimo 8). Si se cambian alli, cambiar aqui.
const malas = {
  'Ab1$':       'length',  // corta aunque lo tenga todo
  '':           'length',
  '123456':     'length',  // la contrasena mas filtrada del mundo
  'ABCDEFG1$':  'lower',   // sin minuscula
  'abcdefg1$':  'upper',   // sin mayuscula
  'Abcdefgh$':  'digit',   // sin numero
  'Abcdefg1':   'symbol',  // sin simbolo
  'password':   'upper',   // 8 justas, tiene minuscula pero no mayuscula
}
for (const [pw, motivo] of Object.entries(malas)) {
  const r = passwordProblem(pw)
  assert.ok(r !== null, `"${pw}" deberia rechazarse y paso`)
  if (pw.length >= PASSWORD_MIN) assert.equal(r, motivo, `"${pw}": esperaba ${motivo}, dio ${r}`)
}
console.log('  OK  rechaza cortas, sin letra, sin número y sin símbolo')

// 'password' tiene 8 caracteres: no se rechaza por corta sino por no tener
// mayuscula, que es el primer grupo que le falta.
assert.equal(passwordProblem('password'), 'upper')
console.log('  OK  "password" (8 caracteres) se rechaza por no tener mayúscula')

// --- Las que hay que aceptar -------------------------------------------------
for (const pw of ['Estudio1#', 'Contraseña1!', 'Ñandú2026#', 'aB3 defgh', 'Ab1$efgh']) {
  assert.equal(passwordProblem(pw), null, `"${pw}" deberia aceptarse y se rechazo`)
}
console.log('  OK  acepta las válidas, incluidas con acentos, Ñ y el espacio como símbolo')

// --- El orden de los avisos es el util para el usuario -----------------------
// Primero la longitud: no tiene sentido pedirle un símbolo a quien lleva
// escritas tres letras.
assert.equal(passwordProblem('a'), 'length')
console.log('  OK  avisa primero de la longitud, antes que del resto')

console.log('\nTodo correcto.')
