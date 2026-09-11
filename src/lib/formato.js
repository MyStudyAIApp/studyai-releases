// ── Formato del cuaderno: texto guardado ⇄ HTML editable ──────────────────
//
// El apunte se GUARDA como texto con marcas (**negrita**, *cursiva*,
// <u>subrayado</u>, ~~tachado~~, "## titulo", "- lista"). Eso no se toca: es
// lo que sale de la transcripcion, lo que lee la IA y lo que entiende el
// render de ReactMarkdown.
//
// Estas dos funciones son solo para el EDITOR y para la exportacion a Word:
// convierten ese texto a HTML y de vuelta, para que el alumno vea la negrita
// en negrita mientras escribe en vez de ver asteriscos.
//
// Las formulas ($...$) y las palabras dudosas ((?)) se quedan como texto a la
// vista. No es una perdida: en el editor de antes tambien se veian asi, y el
// boton de vista previa las pinta de verdad.

const ESCAPAR = { '&': '&amp;', '<': '&lt;', '>': '&gt;' }

/** Texto guardado → HTML para el editor (y para el fichero de Word).
 *
 *  Se escapa TODO primero y luego se devuelve a la vida SOLO lo que
 *  reconocemos. Asi un apunte no puede colar etiquetas arbitrarias en el
 *  editor ni en el documento, aunque el alumno las escriba a mano.
 */
export function textoAHtml(texto) {
  const lineas = String(texto || '')
    .replace(/[&<>]/g, c => ESCAPAR[c])
    .split('\n')

  const salida = []
  let enLista = false

  const enLinea = (t) => t
    .replace(/&lt;u&gt;([^&\n]+)&lt;\/u&gt;/g, '<u>$1</u>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>')

  for (const linea of lineas) {
    const lista = /^[-*]\s+(.*)$/.exec(linea)
    if (lista) {
      if (!enLista) { salida.push('<ul>'); enLista = true }
      salida.push(`<li>${enLinea(lista[1])}</li>`)
      continue
    }
    if (enLista) { salida.push('</ul>'); enLista = false }

    const titulo = /^(#{1,6})\s+(.*)$/.exec(linea)
    if (titulo) {
      const nivel = titulo[1].length === 1 ? 2 : 3
      salida.push(`<h${nivel}>${enLinea(titulo[2])}</h${nivel}>`)
      continue
    }
    salida.push(`<div>${enLinea(linea) || '<br>'}</div>`)
  }
  if (enLista) salida.push('</ul>')

  return salida.join('')
}

// Como se vuelve a escribir cada etiqueta. Las que no estan aqui se ignoran y
// solo se conserva su texto: si el alumno pega algo de una web, entra limpio.
const ENVOLTURAS = {
  B: ['**', '**'], STRONG: ['**', '**'],
  I: ['*', '*'], EM: ['*', '*'],
  U: ['<u>', '</u>'],
  S: ['~~', '~~'], STRIKE: ['~~', '~~'], DEL: ['~~', '~~'],
}
const BLOQUES = { DIV: '', P: '', H1: '# ', H2: '# ', H3: '## ', H4: '## ', H5: '## ', H6: '## ', LI: '- ' }

/** HTML del editor → texto guardado.
 *
 *  Recibe un nodo del DOM (o cualquier cosa con nodeType/tagName/childNodes,
 *  que es lo que permite probarlo sin navegador).
 */
export function htmlATexto(nodo) {
  return limpiar(recorrer(nodo))
}

function recorrer(nodo) {
  if (!nodo) return ''
  if (nodo.nodeType === 3) return nodo.nodeValue ?? nodo.textContent ?? ''   // texto
  if (nodo.nodeType !== 1 && nodo.nodeType !== 11) return ''                 // ni elemento ni raiz

  const etiqueta = (nodo.tagName || '').toUpperCase()
  if (etiqueta === 'BR') return '\n'

  const dentro = Array.from(nodo.childNodes || []).map(recorrer).join('')

  const envoltura = ENVOLTURAS[etiqueta]
  // Una etiqueta vacia no puede dejar las marcas sueltas: "****" no es negrita,
  // es basura que el alumno acabaria viendo.
  if (envoltura) return dentro.trim() ? envoltura[0] + dentro + envoltura[1] : dentro

  if (etiqueta in BLOQUES) return '\n' + BLOQUES[etiqueta] + dentro

  return dentro
}

function limpiar(t) {
  return t
    .replace(/ /g, ' ')        // el espacio duro que mete contentEditable
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
