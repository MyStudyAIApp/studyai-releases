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


// ── Subrayado ─────────────────────────────────────────────────────────────
// Markdown no tiene subrayado: negrita, cursiva y tachado si, subrayado no.
// El alumno SI subraya en su libreta, y la transcripcion lo devuelve como
// <u>asi</u> (lo pide HANDWRITING_SYSTEM).
//
// Por que <u> y no una marca inventada tipo ==asi==: porque se midio. Con ==,
// el modelo NO obedecia ni poniendole un ejemplo — dibujaba la raya debajo con
// guiones. Con <u> acierta a la primera y repite igual. Se guarda lo que el
// modelo ya escribe, asi no hay que traducir nada en el servidor.
//
// Se pinta con el mismo rodeo que las dudas —un enlace de esquema propio— y
// por la misma razon: NO se activa rehype-raw. Aqui solo se reconoce este
// patron exacto; cualquier otra etiqueta que apareciera en el texto se queda
// como texto plano a la vista, que es justo lo que interesa.
export const SUBRAYADO_RE = /<u>([^<>\n]+)<\/u>/g

export function marcarSubrayado(texto) {
  return (texto || '').replace(SUBRAYADO_RE, (entera, dentro) =>
    // ponytail: si dentro ya hay un enlace (una palabra dudosa marcada antes)
    // se deja tal cual. Anidar enlaces rompe el markdown, y subrayar JUSTO una
    // palabra dudosa es raro; en cuanto el alumno la confirma, se subraya.
    dentro.includes('](duda:') ? entera : `[${dentro}](u:)`,
  )
}

/** Lo que se le pasa a ReactMarkdown: dudas primero, subrayado despues. */
export function prepararTexto(texto) {
  return marcarSubrayado(marcarDudas(texto))
}
