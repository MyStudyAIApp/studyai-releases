/**
 * Lectura en voz alta con el motor del PROPIO dispositivo.
 *
 * Sustituye a las llamadas a Azure: es gratis, no consume cupo, funciona sin
 * conexión y el texto no sale del aparato. Azure queda solo para generar los
 * podcasts descargables, que es lo único que el dispositivo no sabe hacer
 * (producir un fichero de audio).
 *
 * ⚠️ Hay DOS motores, y hace falta usar los dos:
 *
 *  - **Web y escritorio**: `speechSynthesis`, la API del navegador.
 *  - **Apps Android**: el motor NATIVO, vía @capacitor-community/text-to-speech.
 *    El WebView de Android **no implementa `speechSynthesis`**: existe el
 *    objeto pero no devuelve voces ni habla. Se descubrió probando en un
 *    Pixel 8 Pro el 23/8/2026, cuando la app decía "tu dispositivo no tiene
 *    voces instaladas" teniéndolas.
 *
 * Todo lo de abajo elige el motor por su cuenta; quien lo llama no se entera.
 */

import { TextToSpeech } from '@capacitor-community/text-to-speech'

// Tamano de los trozos en los que se parte el texto antes de hablarlo.
//
// En el NAVEGADOR hay que trocear corto: Chrome deja de emitir 'end' con
// textos largos y la lectura se queda a medias. En el motor NATIVO de Android
// ese problema no existe y trocear corto solo introduce pausas audibles entre
// bloque y bloque (lo noto el usuario probando), asi que ahi se manda mucho
// mas de una vez.

const esNativo = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()

const hayWebSpeech = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window

// ⚠️ NUNCA hacer `await` sobre un plugin de Capacitor.
//
// registerPlugin() devuelve un PROXY que, ante cualquier propiedad que se le
// pida, responde con una funcion suponiendo que es un metodo nativo. Al hacer
// `await`, JavaScript le pide `.then` para comprobar si es una promesa; el
// proxy contesta que si, JavaScript la llama esperando que le avise... y nadie
// le avisa jamas. La promesa se queda pendiente para siempre.
//
// Costo una tarde el 23/8/2026: la pantalla de voz decia "el modulo de voz no
// respondio" mientras `typeof` confirmaba que el objeto estaba ahi. Se usa
// directamente, sin await ni funcion intermedia.

export const hayVozEnElDispositivo = () => esNativo() || hayWebSpeech()

// ── Voces ──────────────────────────────────────────────────────────────────

let cacheNativa = null

/** "es-ES" → "Español (España)", para poder poner nombre a una voz cuando el
 *  plugin solo nos da el código de idioma. */
function nombreDeIdioma(lang) {
  try {
    return new Intl.DisplayNames(['es'], { type: 'language' }).of(lang) || lang
  } catch {
    return lang
  }
}

/**
 * Devuelve las voces disponibles, con la misma forma en las dos plataformas:
 * { name, lang, localService }.
 */
/** Última razón por la que no se pudieron cargar voces, para poder decírsela
 *  al usuario en vez de dejarle mirando un "buscando…" eterno. */
export let motivoSinVoces = null

/** El plugin nativo puede quedarse sin responder si el motor del sistema aún
 *  no ha terminado de arrancar. Sin este límite, la pantalla se queda colgada
 *  en "Buscando las voces de tu dispositivo…" para siempre (visto en un
 *  Pixel 8 Pro el 23/8/2026). */
function conLimite(promesa, ms, etiqueta) {
  return Promise.race([
    promesa,
    new Promise((_, rechazar) => setTimeout(() => rechazar(new Error(`${etiqueta} no respondió`)), ms)),
  ])
}

export async function cargarVoces(timeoutMs = 3000) {
  if (esNativo()) {
    if (cacheNativa) return cacheNativa
    motivoSinVoces = null
    const tts = TextToSpeech   // sin await: ver el aviso de arriba

    // 1) Lo ideal: la lista de voces con nombre. El plugin las identifica por
    //    su posición, así que se guarda el índice para pasárselo a speak().
    try {
      const { voices } = await conLimite(tts.getSupportedVoices(), timeoutMs, 'la lista de voces')
      if (voices?.length) {
        // Igual que arriba: el motor de Android repite voces por variante.
        const vistas = new Set()
        cacheNativa = voices.map((v, indice) => ({
          name: v.name || v.voiceURI || `Voz ${indice + 1}`,
          lang: v.lang || '',
          localService: v.localService !== false,
          indice,
        })).filter(v => {
          const clave = `${v.name}|${v.lang}`
          if (vistas.has(clave)) return false
          vistas.add(clave)
          return true
        })
        return cacheNativa
      }
    } catch (e) {
      motivoSinVoces = e.message
    }

    // 2) Respaldo: solo los idiomas. Basta para hablar (speak acepta 'lang'
    //    sin elegir voz concreta) y para saber qué idiomas ofrecer.
    try {
      const { languages } = await conLimite(tts.getSupportedLanguages(), timeoutMs, 'la lista de idiomas')
      // Google TTS devuelve una entrada por variante regional, con muchos
      // repetidos: sin agrupar salian cientos de "frances Canada" identicos.
      const vistos = new Set()
      cacheNativa = (languages || []).filter(lang => {
        if (!lang || vistos.has(lang)) return false
        vistos.add(lang)
        return true
      }).map(lang => ({
        name: nombreDeIdioma(lang),
        lang,
        localService: true,
      }))
      if (cacheNativa.length) motivoSinVoces = null
      return cacheNativa
    } catch (e) {
      motivoSinVoces = e.message
      return []
    }
  }

  if (!hayWebSpeech()) return []
  const ya = window.speechSynthesis.getVoices()
  if (ya.length) return ya

  // En el navegador las voces llegan tarde y el evento no siempre se emite.
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
  return [...new Set(voces.map(v => (v.lang || '').split('-')[0].toLowerCase()).filter(Boolean))]
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
  return voces.find(v => (v.lang || '').toLowerCase() === (lang || '').toLowerCase())
      || voces.find(v => (v.lang || '').split('-')[0].toLowerCase() === base)
      || null
}

// ── Preparar el texto ──────────────────────────────────────────────────────

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
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, ' ')
    .replace(/[\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}\u{20E3}]/gu, '')
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
export function trocear(texto, max = null) {
  max = max ?? (esNativo() ? 2000 : 200)
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

/** '+10%' | '10%' | 1.1 → 1.1 (lo que esperan los dos motores) */
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
  fr: /\b(le|les|des|est|une|dans|pour|vous|avec)\b/gi,
  de: /\b(der|die|das|und|ist|nicht|mit|ein|sie|auch)\b/gi,
  it: /\b(che|non|per|sono|come|questo|anche|della)\b/gi,
  pt: /\b(não|uma|com|você|isso|mais|então|muito)\b/gi,
  es: /\b(que|de|la|el|los|una|para|con|porque|está)\b/gi,
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

// ── Hablar y parar ─────────────────────────────────────────────────────────

let cancelado = false

export function parar() {
  cancelado = true
  if (esNativo()) {
    TextToSpeech.stop().catch(() => {})
    return
  }
  if (hayWebSpeech()) window.speechSynthesis.cancel()
}

/**
 * Habla un texto entero. Se resuelve al terminar y se rechaza si el aparato no
 * puede. onProgress(indice, total) permite pintar "parte 2/5".
 */
export async function hablar(texto, { lang = 'es-ES', voz = null, rate = 1, onProgress } = {}) {
  const trozos = trocear(texto)
  if (!trozos.length) return

  cancelado = false

  if (esNativo()) {
    const tts = TextToSpeech   // sin await: ver el aviso de arriba
    await tts.stop().catch(() => {})
    for (let i = 0; i < trozos.length; i++) {
      if (cancelado) return
      onProgress?.(i, trozos.length)
      await tts.speak({
        text: trozos[i],
        lang: voz?.lang || lang,
        rate: ritmoANumero(rate),
        // El plugin identifica la voz por su posición en getSupportedVoices()
        ...(typeof voz?.indice === 'number' ? { voice: voz.indice } : {}),
      })
    }
    return
  }

  if (!hayWebSpeech()) throw new Error('Este dispositivo no puede reproducir voz')

  return new Promise((resolve, reject) => {
    window.speechSynthesis.cancel()
    let i = 0

    const siguiente = () => {
      if (cancelado) { resolve(); return }
      if (i >= trozos.length) { resolve(); return }
      onProgress?.(i, trozos.length)

      const u = new SpeechSynthesisUtterance(trozos[i])
      if (voz) u.voice = voz
      u.lang = voz?.lang || lang
      u.rate = ritmoANumero(rate)
      u.onend = () => { i += 1; siguiente() }
      u.onerror = e => {
        // 'interrupted'/'canceled' salen al pulsar Parar: no son fallos.
        if (e?.error === 'interrupted' || e?.error === 'canceled') { resolve(); return }
        reject(new Error('No se pudo reproducir la voz'))
      }
      window.speechSynthesis.speak(u)
    }
    siguiente()
  })
}

/**
 * Abre la pantalla del sistema donde se instalan voces. Solo en las apps
 * Android: desde un navegador NO hay forma de llegar ahí (comprobado el
 * 23/8/2026 con ms-settings: en Chrome de Windows — no abre nada).
 */
export async function abrirInstalacionDeVoces() {
  if (!esNativo()) return false

  // ⚠️ openInstall() del plugin busca la pantalla ACTION_CHECK_TTS_DATA y, si
  // no la encuentra, NO HACE NADA -- y aun asi resuelve como si hubiera ido
  // bien (visto en su codigo Java). En un Pixel 8 Pro no abre nada, asi que no
  // basta con llamarlo: hay que comprobar si de verdad se abrio algo.
  //
  // Se detecta igual que en la web: si la app pierde el foco es que algo se
  // puso delante. Si no, quien llama debe explicarle al usuario como llegar a
  // mano.
  let salio = false
  const marcar = () => { salio = true }
  window.addEventListener('blur', marcar, { once: true })
  document.addEventListener('visibilitychange', marcar, { once: true })

  try {
    await TextToSpeech.openInstall()
  } catch { /* el plugin casi nunca falla aqui: falla en silencio */ }

  await new Promise(r => setTimeout(r, 1200))
  window.removeEventListener('blur', marcar)
  document.removeEventListener('visibilitychange', marcar)
  return salio
}

/** Cómo llegar a mano, para cuando no se puede abrir la pantalla. */
export const RUTA_AJUSTES_VOZ =
  'Ajustes de Android → Sistema → Idiomas → Salida de texto a voz'
