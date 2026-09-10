// ── Palabras dudosas ──────────────────────────────────────────────────────
// La transcripcion marca con "(?)" pegado toda palabra de la que no esta
// segura (lo pide HANDWRITING_SYSTEM en el backend). Antes eso era un callejon
// sin salida: se le avisaba al alumno de que algo podia estar mal y no se le
// daba forma de arreglarlo.
//
// Se convierten en un ENLACE markdown con esquema propio, `[palabra](duda:N)`,
// y luego se intercepta ese enlace para dibujar un boton. Parece un rodeo, pero
// es lo mas corto que respeta el pipeline de markdown + KaTeX: meter HTML
// crudo obligaria a anadir rehype-raw y a abrir la puerta a etiquetas
// arbitrarias dentro de un texto que viene de un modelo.
//
// N es la POSICION de la duda, no la palabra: si "decir(?)" sale tres veces,
// hay que saber cual toco el alumno.
export const DUDA_RE = /([\wÁÉÍÓÚÜÑáéíóúüñ'’.,-]+)\(\?\)/g

export function marcarDudas(texto) {
  let n = -1
  return (texto || '').replace(DUDA_RE, (_, palabra) => {
    n += 1
    return `[${palabra}](duda:${n})`
  })
}

/** Sustituye SOLO la duda numero `indice`, dejando el resto como estan. */
export function resolverDuda(texto, indice, palabraNueva) {
  let n = -1
  return (texto || '').replace(DUDA_RE, (entera, palabra) => {
    n += 1
    return n === indice ? (palabraNueva ?? palabra) : entera
  })
}

export function contarDudas(texto) {
  return ((texto || '').match(DUDA_RE) || []).length
}
