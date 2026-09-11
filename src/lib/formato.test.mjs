// Comprobaciones del formato del cuaderno (texto guardado ⇄ HTML del editor).
// Ejecutar:  node src/lib/formato.test.mjs
//
// htmlATexto recorre nodos del DOM, pero solo usa nodeType/tagName/childNodes,
// asi que aqui se le pasan objetos normales. Sin navegador y sin librerias.
import assert from 'node:assert/strict'
import { textoAHtml, htmlATexto } from './formato.js'

const txt = (s) => ({ nodeType: 3, nodeValue: s })
const el = (tagName, ...childNodes) => ({ nodeType: 1, tagName, childNodes })

const casos = {
  'negrita, cursiva, subrayado y tachado a HTML'() {
    assert.equal(textoAHtml('esto es **fuerte**'), '<div>esto es <b>fuerte</b></div>')
    assert.equal(textoAHtml('esto es *suave*'), '<div>esto es <i>suave</i></div>')
    assert.equal(textoAHtml('esto va <u>subrayado</u>'), '<div>esto va <u>subrayado</u></div>')
    assert.equal(textoAHtml('esto esta ~~fuera~~'), '<div>esto esta <s>fuera</s></div>')
  },

  'titulos y listas'() {
    assert.equal(textoAHtml('# Grande'), '<h2>Grande</h2>')
    assert.equal(textoAHtml('## Mediano'), '<h3>Mediano</h3>')
    assert.equal(textoAHtml('- uno\n- dos'), '<ul><li>uno</li><li>dos</li></ul>')
  },

  'una linea vacia sigue siendo una linea vacia'() {
    assert.equal(textoAHtml('a\n\nb'), '<div>a</div><div><br></div><div>b</div>')
  },

  'las formulas y las dudas pasan intactas'() {
    const f = 'la raiz $\\sqrt{2}$ y la palabra(?) dudosa'
    assert.equal(textoAHtml(f), `<div>${f}</div>`)
  },

  'lo que el alumno escriba como etiqueta NO se convierte en etiqueta'() {
    // Solo <u> esta permitido; cualquier otra cosa se queda como texto visible.
    assert.equal(textoAHtml('mira <script>alert(1)</script>'),
                 '<div>mira &lt;script&gt;alert(1)&lt;/script&gt;</div>')
    assert.equal(textoAHtml('5 < 7 y 9 > 3'), '<div>5 &lt; 7 y 9 &gt; 3</div>')
  },

  'del editor al texto guardado'() {
    const raiz = el('DIV',
      el('DIV', txt('esto es '), el('B', txt('fuerte'))),
      el('DIV', txt('y esto '), el('U', txt('subrayado'))))
    assert.equal(htmlATexto(raiz), 'esto es **fuerte**\ny esto <u>subrayado</u>')
  },

  'el navegador puede usar STRONG y EM en vez de B e I'() {
    const raiz = el('DIV', el('DIV', el('STRONG', txt('a')), txt(' '), el('EM', txt('b'))))
    assert.equal(htmlATexto(raiz), '**a** *b*')
  },

  'titulos y listas vuelven a sus marcas'() {
    const raiz = el('DIV',
      el('H2', txt('Grande')),
      el('UL', el('LI', txt('uno')), el('LI', txt('dos'))))
    assert.equal(htmlATexto(raiz), '# Grande\n- uno\n- dos')
  },

  'una etiqueta vacia no deja las marcas sueltas'() {
    // Pulsar negrita sin escribir nada no puede acabar en "****" guardado.
    const raiz = el('DIV', el('DIV', el('B', txt('  ')), txt('hola')))
    assert.equal(htmlATexto(raiz), 'hola')
  },

  'lo pegado de fuera entra limpio'() {
    // Un SPAN con estilos no es formato nuestro: se queda solo su texto.
    const raiz = el('DIV', el('DIV', el('SPAN', txt('texto pegado')), el('FONT', txt(' mas'))))
    assert.equal(htmlATexto(raiz), 'texto pegado mas')
  },

  'ida y vuelta: el texto no cambia'() {
    // Lo importante de verdad: editar sin tocar nada no puede reescribir el
    // apunte del alumno.
    const original = [
      '# Tema 3',
      'Una frase con **negrita**, *cursiva*, <u>subrayado</u> y ~~tachado~~.',
      '',
      '- primero',
      '- segundo',
      '',
      'La formula $\\frac{3}{2}$ y una palabra(?) dudosa.',
    ].join('\n')

    // Se simula lo que hace el navegador: parsear el HTML a nodos.
    const raiz = parsear(textoAHtml(original))
    assert.equal(htmlATexto(raiz), original)
  },
}

// Mini parser, solo para la prueba de ida y vuelta: entiende el HTML que
// genera textoAHtml, que es el que genera este mismo fichero.
function parsear(html) {
  const raiz = el('DIV')
  const pila = [raiz]
  const re = /<(\/?)([a-z0-9]+)\s*\/?>|([^<]+)/gi
  let m
  while ((m = re.exec(html))) {
    const [, cierre, etiqueta, texto] = m
    const actual = pila[pila.length - 1]
    if (texto != null) {
      actual.childNodes.push(txt(texto.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')))
    } else if (etiqueta.toUpperCase() === 'BR') {
      actual.childNodes.push(el('BR'))
    } else if (cierre) {
      pila.pop()
    } else {
      const nuevo = el(etiqueta.toUpperCase())
      actual.childNodes.push(nuevo)
      pila.push(nuevo)
    }
  }
  return raiz
}

let fallos = 0
for (const [nombre, fn] of Object.entries(casos)) {
  try { fn(); console.log('OK  ' + nombre) }
  catch (e) { fallos++; console.error('FALLO  ' + nombre + '\n   ' + e.message) }
}
console.log(fallos ? `\n${fallos} fallo(s).` : '\nTodo correcto.')
process.exit(fallos ? 1 : 0)
