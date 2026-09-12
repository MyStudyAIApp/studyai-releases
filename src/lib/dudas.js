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
import { marcarExponentes } from '../utils/mathText.js'

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

// ── Saltos de linea ───────────────────────────────────────────────────────
// En markdown, un salto de linea suelto NO es un salto: dos renglones seguidos
// se pegan en el mismo parrafo. El alumno escribe su libreta en renglones, y
// en el cuaderno los veia todos corridos aunque la transcripcion los traia
// bien separados (lo conto un usuario el 12/9/2026).
//
// Se marca como salto DE VERDAD (dos espacios al final, que en markdown es el
// salto duro) en vez de convertir cada linea en su propio parrafo: partir por
// parrafos rompe las TABLAS, que necesitan sus filas seguidas, y el cuaderno
// las pinta (remark-gfm). Las lineas en blanco se quedan como estan y siguen
// separando parrafos.
export function respetarSaltos(texto) {
  return String(texto ?? '').replace(/([^\n])\n(?!\n)/g, '$1  \n')
}

/** Lo que se le pasa a ReactMarkdown: dudas primero, subrayado despues, los
 *  exponentes sueltos ("10^n") sobre el texto ya marcado, y los saltos de
 *  linea al final.
 *
 *  El orden importa: los exponentes envuelven trozos en $...$ y hacerlo antes
 *  dejaria la marca de duda separada de su palabra; los saltos van los ultimos
 *  para no tener que esquivar los dos espacios en cada regex anterior. */
export function prepararTexto(texto) {
  return respetarSaltos(marcarExponentes(marcarSubrayado(marcarDudas(texto))))
}


// ── Dejar pasar NUESTROS dos esquemas ─────────────────────────────────────
// react-markdown limpia por seguridad la direccion de todo enlace que no sea
// http/https/mailto/tel: la deja VACIA. Como `duda:N` y `u:` no estan en esa
// lista, al componente le llegaba `href=""` y no habia forma de distinguirlos.
//
// Esto no era un detalle: rompia las dos cosas a la vez -- el subrayado no se
// veia y los botones ambar de las palabras dudosas dejaban de ser botones.
// Se descubrio el 11/9/2026 renderizando de verdad en node, porque a simple
// vista el markdown que entraba era correcto.
//
// Se dejan pasar SOLO esos dos y el resto sigue pasando por el filtro de
// siempre: un apunte puede traer lo que sea (lo escribe un modelo o el propio
// alumno) y un `javascript:` en un enlace seguiria siendo un agujero.
export function transformarUrl(url, defecto) {
  const u = String(url || '')
  return (u === 'u:' || u.startsWith('duda:')) ? u : defecto(url)
}
