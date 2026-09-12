// Comprobaciones de los exponentes sueltos del apunte.
// Ejecutar:  node src/utils/mathText.test.mjs
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { marcarExponentes, ensureMathDelimiters } from './mathText.js'
import { prepararTexto, transformarUrl } from '../lib/dudas.js'

const pintar = (texto) => renderToStaticMarkup(createElement(ReactMarkdown, {
  remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex], children: texto,
  urlTransform: (u) => transformarUrl(u, defaultUrlTransform),
}))

const casos = {
  'envuelve el exponente suelto'() {
    assert.equal(marcarExponentes('x · 10^n'), 'x · $10^{n}$')
    assert.equal(marcarExponentes('area de 5 cm^2 y 3 m^3'), 'area de 5 $cm^{2}$ y 3 $m^{3}$')
    assert.equal(marcarExponentes('vale 10^{-3} metros'), 'vale $10^{-3}$ metros')
  },

  'no toca lo que ya es formula'() {
    assert.equal(marcarExponentes('la raiz $\\sqrt[3]{8}$ y $x^2$'), 'la raiz $\\sqrt[3]{8}$ y $x^2$')
    assert.equal(marcarExponentes('$$E = mc^2$$'), '$$E = mc^2$$')
  },

  'no toca el texto normal'() {
    const t = 'Notacion cientifica. Se usa para numeros muy altos.'
    assert.equal(marcarExponentes(t), t)
    assert.equal(marcarExponentes(''), '')
    assert.equal(marcarExponentes(null), '')
  },

  'aplicarlo dos veces no cambia nada'() {
    const una = marcarExponentes('x · 10^n')
    assert.equal(marcarExponentes(una), una)
  },

  'ensureMathDelimiters sigue envolviendo el LaTeX suelto'() {
    assert.equal(ensureMathDelimiters('\\frac{1}{2}'), '$\\frac{1}{2}$')
  },

  'KaTeX lo pinta de verdad como exponente'() {
    // El caso del usuario, tal cual sale del cuaderno.
    const html = pintar(prepararTexto('entre 1 y 9) x · 10^n'))
    assert.ok(html.includes('katex'), 'no llego a KaTeX: ' + html)
    // msupsup/msup = el numerito pequeño arriba; sin esto seria texto plano.
    assert.ok(/msup|vlist/.test(html), 'no hay exponente en el HTML: ' + html)
    assert.ok(!html.includes('10^n'), 'el ^ sigue crudo: ' + html)
  },

  'una palabra dudosa junto a un exponente sigue siendo boton'() {
    const html = pintar(prepararTexto('el valor 10^n es decir(?) eso'))
    assert.ok(html.includes('duda:0'), 'se perdio la duda: ' + html)
  },
}

let fallos = 0
for (const [nombre, prueba] of Object.entries(casos)) {
  try { prueba(); console.log('ok  -', nombre) }
  catch (e) { fallos++; console.error('FALLA -', nombre, '\n   ', e.message) }
}
process.exit(fallos ? 1 : 0)
