/**
 * Comprobación del módulo de voz del dispositivo.
 * Ejecutar: node src/lib/deviceTts.test.mjs
 *
 * No necesita navegador: solo se prueban las partes puras (trocear, detectar
 * idioma, convertir el ritmo). Hablar de verdad hay que probarlo en el aparato.
 */
import assert from 'node:assert'
import { trocear, detectarIdioma, ritmoANumero } from './deviceTts.js'

// --- trocear: Chrome corta los textos largos, hay que partir por frases ---
const largo = 'La mitosis consta de cuatro fases bien diferenciadas. La primera es la profase, '
  + 'en la que la cromatina se condensa. Después viene la metafase, donde los cromosomas '
  + 'se alinean en el ecuador de la célula. La anafase separa las cromátidas hacia los polos. '
  + 'Por último, la telofase reconstruye las envolturas nucleares.'
const trozos = trocear(largo)
assert.ok(trozos.length > 1, 'un texto largo debe partirse en varios trozos')
assert.ok(trozos.every(t => t.length <= 200), 'ningún trozo debe pasar de 200 caracteres')
assert.strictEqual(
  trozos.join(' ').replace(/\s+/g, ' '),
  largo.replace(/\s+/g, ' ').trim(),
  'trocear no puede perder ni duplicar texto',
)

// una frase sola gigantesca, sin puntuación, también hay que partirla
const sinPuntos = 'palabra '.repeat(60).trim()
assert.ok(trocear(sinPuntos).every(t => t.length <= 200), 'una frase enorme debe partirse igual')

assert.deepStrictEqual(trocear(''), [], 'texto vacío no produce trozos')
assert.deepStrictEqual(trocear('   '), [], 'solo espacios no produce trozos')

// --- detectar idioma: elegir voz, no hacer lingüística ---
assert.strictEqual(detectarIdioma('La célula que se divide para formar dos'), 'es-ES')
assert.strictEqual(detectarIdioma('The cell that divides and forms two with this'), 'en-GB')
assert.strictEqual(detectarIdioma('Die Zelle, die sich teilt und ist nicht mit ein'), 'de-DE')
assert.strictEqual(detectarIdioma('xyz 123'), 'es-ES', 'sin pistas, español por defecto')

// las palabras cortas no deben contar dentro de otras palabras: "hola" no es
// francés por contener "la" (este era un fallo real antes de poner \b)
assert.strictEqual(detectarIdioma('Hola, la clase de hoy trata que es para todos'), 'es-ES')

// --- ritmo: la app guarda '+10%' y SpeechSynthesis quiere 1.1 ---
assert.strictEqual(ritmoANumero('+10%'), 1.1)
assert.strictEqual(ritmoANumero('0%'), 1)
assert.strictEqual(ritmoANumero('-20%'), 0.8)
assert.strictEqual(ritmoANumero(1.5), 1.5)
assert.strictEqual(ritmoANumero(undefined), 1, 'sin valor, ritmo normal')
assert.strictEqual(ritmoANumero('+500%'), 2, 'se limita al máximo que admite el navegador')
assert.strictEqual(ritmoANumero('-90%'), 0.5, 'se limita al mínimo')

console.log('OK — trocear, detectarIdioma y ritmoANumero se comportan')
