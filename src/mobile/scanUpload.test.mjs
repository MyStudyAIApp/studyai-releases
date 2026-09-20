// Comprobacion de la cola de escaneo. Sin frameworks: node scanUpload.test.mjs
//
// Lo que protege es lo que de verdad puede romperse en silencio:
//  - que encolar sobre un trabajo vivo SUME al total en vez de empezar otro
//    (si no, el alumno pierde de vista las paginas de antes),
//  - que cada escaneo vaya a SU documento y no se mezclen dos escaneos
//    distintos en uno solo,
//  - que un fallo a mitad deje contadas las que SI entraron.
//
// El modulo real toca canvas, Capacitor e i18n, que no existen en node. Aqui
// se reimplementa solo el bucle de la cola, que es la logica con estado.

import assert from 'node:assert/strict'

function crearCola(subir) {
  let trabajo = null, contador = 0
  const encolar = (paginas, campos) => {
    const lote = { id: ++contador, campos, docId: null }
    const nuevas = paginas.map(b64 => ({ b64, lote }))
    if (trabajo && !trabajo.terminado) {
      trabajo.cola.push(...nuevas); trabajo.total += nuevas.length
      return { encolado: true, fin: trabajo.fin }
    }
    trabajo = { cola: nuevas, total: nuevas.length, guardadas: 0, terminado: false, error: null }
    trabajo.fin = (async () => {
      try {
        while (trabajo.cola.length) {
          const { b64, lote } = trabajo.cola.shift()
          const resp = await subir(b64, lote)
          if (!lote.campos.modoCuaderno && !lote.docId) lote.docId = resp?.id ?? null
          trabajo.guardadas += 1
        }
      } catch (e) { trabajo.error = String(e.message ?? e) }
      finally { trabajo.terminado = true }
    })()
    return { encolado: false, fin: trabajo.fin }
  }
  return { encolar, estado: () => trabajo }
}

const pausa = ms => new Promise(r => setTimeout(r, ms))

async function test_encolar_suma_al_total() {
  const vistos = []
  const { encolar, estado } = crearCola(async (b64) => { await pausa(5); vistos.push(b64); return { id: 'doc1' } })
  const a = encolar(['p1', 'p2'], { modoCuaderno: true })
  assert.equal(a.encolado, false, 'el primero arranca trabajo nuevo')
  await pausa(1)
  const b = encolar(['p3'], { modoCuaderno: true })
  assert.equal(b.encolado, true, 'el segundo se encola sobre el vivo')
  assert.equal(estado().total, 3, 'el total tiene que crecer a 3')
  await a.fin
  assert.deepEqual(vistos, ['p1', 'p2', 'p3'], 'se procesan todas y en orden')
  assert.equal(estado().guardadas, 3)
}

async function test_cada_escaneo_a_su_documento() {
  const enviados = []
  const { encolar } = crearCola(async (b64, lote) => {
    await pausa(5)
    enviados.push({ b64, docId: lote.docId })
    return { id: `doc-lote-${lote.id}` }
  })
  const a = encolar(['a1', 'a2'], { modoCuaderno: false })
  await pausa(1)
  encolar(['b1', 'b2'], { modoCuaderno: false })
  await a.fin
  // La primera de cada lote abre documento (docId null); la segunda se le pega.
  assert.equal(enviados[0].docId, null,           'a1 abre documento')
  assert.equal(enviados[1].docId, 'doc-lote-1',   'a2 se pega al de a1')
  assert.equal(enviados[2].docId, null,           'b1 abre OTRO documento, no el de a')
  assert.equal(enviados[3].docId, 'doc-lote-2',   'b2 se pega al de b1')
}

async function test_fallo_a_mitad_cuenta_las_que_entraron() {
  let n = 0
  const { encolar, estado } = crearCola(async () => {
    await pausa(2)
    if (++n === 3) throw new Error('503 del proveedor')
    return { id: 'doc1' }
  })
  const a = encolar(['p1', 'p2', 'p3', 'p4'], { modoCuaderno: true })
  await a.fin
  assert.equal(estado().guardadas, 2, 'las 2 primeras SI entraron y deben contarse')
  assert.match(estado().error, /503/)
  assert.equal(estado().terminado, true)
}

const tests = [
  test_encolar_suma_al_total,
  test_cada_escaneo_a_su_documento,
  test_fallo_a_mitad_cuenta_las_que_entraron,
]

let fallos = 0
for (const t of tests) {
  try { await t(); console.log('OK  ' + t.name) }
  catch (e) { fallos++; console.log('FALLA  ' + t.name + ': ' + e.message) }
}
console.log(fallos ? `\n${fallos} fallo(s).` : '\nTodo correcto.')
process.exit(fallos ? 1 : 0)
