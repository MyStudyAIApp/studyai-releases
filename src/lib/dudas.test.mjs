// Comprobaciones de las palabras dudosas del cuaderno.
// Ejecutar:  node src/lib/dudas.test.mjs
import assert from 'node:assert/strict'
import { marcarDudas, resolverDuda, contarDudas } from './dudas.js'

const casos = {
  'cuenta las dudas'() {
    assert.equal(contarDudas('esto es decir(?) y otra palabra(?) mas'), 2)
    assert.equal(contarDudas('sin ninguna duda aqui'), 0)
    assert.equal(contarDudas(''), 0)
    assert.equal(contarDudas(null), 0)
  },

  'las convierte en enlaces numerados'() {
    assert.equal(
      marcarDudas('el numero decir(?) y luego otra(?)'),
      'el numero [decir](duda:0) y luego [otra](duda:1)',
    )
  },

  'respeta acentos, enes y apostrofos'() {
    assert.equal(marcarDudas('la biología(?) del número(?)'),
                 'la [biología](duda:0) del [número](duda:1)')
    // Los decimales del cuaderno del usuario se escriben con apostrofo: 1'5
    assert.equal(marcarDudas("vale 1'5(?) euros"), "vale [1'5](duda:0) euros")
  },

  'no toca el texto sin dudas'() {
    const t = 'Números racionales: entre 2 enteros. ¿Y qué más?'
    assert.equal(marcarDudas(t), t)
  },

  'corrige SOLO la duda tocada aunque la palabra se repita'() {
    const texto = 'decir(?) y decir(?) y decir(?)'
    assert.equal(resolverDuda(texto, 1, 'DECIR'), 'decir(?) y DECIR y decir(?)')
  },

  'confirmar quita la interrogacion y deja la palabra'() {
    // undefined = boton "Correcto": la palabra estaba bien, solo sobra la marca
    assert.equal(resolverDuda('es decir(?) asi', 0, undefined), 'es decir asi')
  },

  'editar sustituye la palabra'() {
    assert.equal(resolverDuda('en fin(?) decimales', 0, 'decir'), 'en decir decimales')
  },

  'un indice que no existe no cambia nada'() {
    const t = 'una duda(?) sola'
    assert.equal(resolverDuda(t, 7, 'otra'), t)
  },

  'no confunde un parentesis normal con una duda'() {
    const t = 'los reales (R) y los enteros (Z)'
    assert.equal(contarDudas(t), 0)
    assert.equal(marcarDudas(t), t)
  },

  'resolver dos veces seguidas deja el texto limpio'() {
    let t = 'en fin(?) decimales y frasciones(?)'
    t = resolverDuda(t, 0, 'decir')
    assert.equal(contarDudas(t), 1)
    t = resolverDuda(t, 0, 'fracciones')
    assert.equal(t, 'en decir decimales y fracciones')
    assert.equal(contarDudas(t), 0)
  },
}

let fallos = 0
for (const [nombre, fn] of Object.entries(casos)) {
  try { fn(); console.log('OK  ' + nombre) }
  catch (e) { fallos++; console.error('FALLO  ' + nombre + '\n   ' + e.message) }
}
console.log(fallos ? `\n${fallos} fallo(s).` : '\nTodo correcto.')
process.exit(fallos ? 1 : 0)
