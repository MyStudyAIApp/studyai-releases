/**
 * Lectura en voz alta con el motor del PROPIO dispositivo (SpeechSynthesis).
 *
 * Sustituye a las llamadas a /tts/speak (Azure). Motivos:
 *  - Gratis: no consume cupo ni cuesta dinero, así que se puede ofrecer sin
 *    límite. Azure queda solo para generar los podcasts descargables, que es
 *    lo único que el navegador no sabe hacer (no puede producir un fichero).
 *  - Funciona sin conexión y no envía el texto a ningún tercero.
 *
 * A cambio, las voces disponibles dependen del aparato: por eso todo lo de
 * abajo comprueba antes de hablar en vez de dar nada por supuesto.
 */

const CORTE_MAX = 200   // caracteres por fragmento

export const hayVozEnElDispositivo = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window

/**
 * Las voces se cargan de forma asíncrona y no todos los navegadores emiten
 * 'voiceschanged' de forma fiable, así que se sondea con un límite.
 */
export function cargarVoces(timeoutMs = 3000) {
  if (!hayVozEnElDispositivo()) return Promise.resolve([])
  const ya = window.speechSynthesis.getVoices()
  if (ya.length) return Promise.resolve(ya)

  return new Promise(resolve => {
    let resuelto = false
    const terminar = () => {
      if (resuelto) return
      resuelto = true
      clearInterval(sondeo)
      clearTimeout(limite)
      window.speechSynthesis.removeEventListener('voiceschanged', terminar)
      resolve(window.speechSynthesis.getVoices())
    }
    window.speechSynthesis.addEventListener('voiceschanged', terminar)
    const sondeo = setInterval(() => {
      if (window.speechSynthesis.getVoices().length) terminar()
    }, 200)
    const limite = setTimeout(terminar, timeoutMs)
  })
}

/** Códigos de idioma disponibles, en minúsculas y sin región: ['es','en',...] */
export async function idiomasDisponibles() {
  const voces = await cargarVoces()
  return [...new Set(voces.map(v => v.lang.split('-')[0].toLowerCase()))]
}

export async function hayVozPara(lang) {
  if (!lang) return hayVozEnElDispositivo()
  const base = lang.split('-')[0].toLowerCase()
  return (await idiomasDisponibles()).includes(base)
}

/**
 * Elige voz para un idioma. Prioriza la que el usuario haya fijado en Ajustes
 * (por nombre), luego una coincidencia exacta de región, y por último
 * cualquiera del mismo idioma.
 */
export async function elegirVoz(lang, preferidasPorIdioma = {}) {
  const voces = await cargarVoces()
  if (!voces.length) return null
  const base = (lang || 'es').split('-')[0].toLowerCase()

  const preferida = preferidasPorIdioma[base]
  if (preferida) {
    const encontrada = voces.find(v => v.name === preferida)
    if (encontrada) return encontrada
  }
  return voces.find(v => v.lang.toLowerCase() === (lang || '').toLowerCase())
      || voces.find(v => v.lang.split('-')[0].toLowerCase() === base)
      || null
}

/**
 * Quita lo que no se debe pronunciar.
 *
 * El motor del dispositivo lee el NOMBRE de cada emoji ("sol con cara"), cosa
 * que Azure no hacía. El tutor usa emojis con naturalidad, así que sin esto la
 * lectura se llena de ruido. También se quitan las marcas de Markdown, que el
 * modelo emite a menudo y se leerían como asteriscos y almohadillas.
 */
export function limpiarParaHablar(texto) {
  return String(texto)
    // emojis, pictogramas, banderas y sus modificadores
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, ' ')
    .replace(/[\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}\u{20E3}]/gu, '')
    // énfasis y encabezados de Markdown (los guiones bajos solo si envuelven
    // palabras: en medio de una, forman parte del término)
    .replace(/[*`#]+/g, ' ')
    .replace(/(^|\s)_+|_+(?=\s|$)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Trocea por frases. Chrome corta los textos largos a mitad y deja de emitir
 * 'end', así que hablar de golpe un resumen entero no es fiable. Se parte por
 * puntuación y solo se trocea a lo bruto si una frase suelta es enorme.
 */
export function trocear(texto, max = CORTE_MAX) {
  const frases = limpiarParaHablar(texto).match(/[^.!?…]+[.!?…]*\s*/g) || []
  const trozos = []
  let actual = ''

  for (const frase of frases) {
    if (frase.length > max) {
      if (actual) { trozos.push(actual.trim()); actual = '' }
      for (let i = 0; i < frase.length; i += max) trozos.push(frase.slice(i, i + max).trim())
      continue
    }
    if ((actual + frase).length > max) {
      trozos.push(actual.trim())
      actual = frase
    } else {
      actual += frase
    }
  }
  if (actual.trim()) trozos.push(actual.trim())
  return trozos.filter(Boolean)
}

/** '+10%' | '10%' | 1.1 → 1.1 (lo que espera SpeechSynthesis) */
export function ritmoANumero(rate) {
  if (typeof rate === 'number') return Math.min(2, Math.max(0.5, rate))
  const m = String(rate ?? '').match(/(-?\d+(?:\.\d+)?)\s*%/)
  if (!m) return 1
  return Math.min(2, Math.max(0.5, 1 + parseFloat(m[1]) / 100))
}

/**
 * Detecta el idioma por palabras muy frecuentes. Es deliberadamente tonto: no
 * merece la pena traerse una librería solo para elegir voz, y equivocarse
 * significa como mucho leer con acento raro, no romper nada.
 */
const PISTAS = {
  en: /\b(the|and|you|that|with|this|from|have|what|your)\b/gi,
  fr: /\b(le|la|les|des|est|une|dans|pour|vous|avec)\b/gi,
  de: /\b(der|die|das|und|ist|nicht|mit|ein|sie|auch)\b/gi,
  it: /\b(che|non|per|una|sono|come|questo|anche|della)\b/gi,
  pt: /\b(que|não|uma|com|para|você|isso|mais|como)\b/gi,
  es: /\b(que|de|la|el|los|una|para|con|como|porque)\b/gi,
}
const REGION = { es: 'es-ES', en: 'en-GB', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', pt: 'pt-PT' }

export function detectarIdioma(texto, porDefecto = 'es-ES') {
  const muestra = String(texto).slice(0, 400)
  let mejor = null
  let mejorPuntos = 0
  for (const [lang, re] of Object.entries(PISTAS)) {
    const puntos = (muestra.match(re) || []).length
    if (puntos > mejorPuntos) { mejorPuntos = puntos; mejor = lang }
  }
  return mejor ? (REGION[mejor] || mejor) : porDefecto
}

export function parar() {
  if (hayVozEnElDispositivo()) window.speechSynthesis.cancel()
}

/**
 * Abre la pantalla del sistema donde se instalan voces. Solo funciona en las
 * apps Android: desde un navegador NO hay forma de llegar ahí (comprobado el
 * 23/8/2026 con ms-settings: en Chrome de Windows — no abre nada). En web solo
 * queda avisar al usuario por escrito.
 */
export async function abrirInstalacionDeVoces() {
  if (!window.Capacitor?.isNativePlatform?.()) return false
  try {
    const { TextToSpeech } = await import('@capacitor-community/text-to-speech')
    await TextToSpeech.openInstall()
    return true
  } catch {
    return false
  }
}

/**
 * Habla un texto entero. Devuelve una promesa que se resuelve al terminar y
 * se rechaza si el dispositivo no puede.
 *
 * onProgress(indice, total) permite pintar "parte 2/5" como hacía el
 * reproductor anterior.
 */
export function hablar(texto, { lang = 'es-ES', voz = null, rate = 1, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    if (!hayVozEnElDispositivo()) {
      reject(new Error('Este dispositivo no puede reproducir voz'))
      return
    }
    const trozos = trocear(texto)
    if (!trozos.length) { resolve(); return }

    window.speechSynthesis.cancel()
    let i = 0
    let cancelado = false

    const siguiente = () => {
      if (cancelado) return
      if (i >= trozos.length) { resolve(); return }
      onProgress?.(i, trozos.length)

      const u = new SpeechSynthesisUtterance(trozos[i])
      if (voz) u.voice = voz
      u.lang = voz?.lang || lang
      u.rate = ritmoANumero(rate)
      u.onend = () => { i += 1; siguiente() }
      u.onerror = e => {
        // 'interrupted'/'canceled' salen al pulsar Parar: no son fallos.
        if (e?.error === 'interrupted' || e?.error === 'canceled') { cancelado = true; resolve(); return }
        reject(new Error('No se pudo reproducir la voz'))
      }
      window.speechSynthesis.speak(u)
    }
    siguiente()
  })
}
