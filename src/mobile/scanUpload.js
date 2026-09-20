import i18n from '../i18n'
import { apiUpload, UPLOAD_TIMEOUT_OCR_MS } from '../store/appStore'

// El lado largo al que el SERVIDOR reescala nada mas recibir la foto
// (processors/ocr_processor.OCR_MAX_DIMENSION). Reescalar aqui al mismo numero
// no pierde nada — medido el 2026-09-20 con 4 fotos reales de 12,5 MP: la
// transcripcion sale palabra por palabra igual — y ahorra 4,4x de subida.
//
// Antes se mandaba la foto entera: 4 paginas eran 10,8 MB, unos 89 s a 1 Mbps,
// que es lo que hay en un aula con 4G. La IA solo tardaba 27 s. O sea que la
// mayor parte de la espera era mandar pixeles que el servidor tiraba.
//
// ⚠️ Si cambia OCR_MAX_DIMENSION en el servidor, cambiar este numero tambien.
// Quedarse corto aqui SI pierde calidad, y en silencio: a 1800 px se pierden
// el apostrofo de 1'5 y la raya de periodo, y ampliar despues no los recupera.
export const LADO_MAX = 2600
const CALIDAD = 0.9

// ── Estado del trabajo, FUERA de React ────────────────────────────────────
// Vive aqui a proposito: con "Avisame" el alumno navega a otra pantalla y el
// componente se desmonta. Si el bucle viviera dentro, se quedaria a medias y
// perderia las paginas que faltan.
let trabajo = null
let contadorLote = 0
const oyentes = new Set()

function avisar() {
  for (const cb of oyentes) { try { cb(trabajo && { ...trabajo }) } catch { /* un oyente roto no para la subida */ } }
}

export function suscribir(cb) {
  oyentes.add(cb)
  cb(trabajo && { ...trabajo })
  return () => oyentes.delete(cb)
}

export function estadoTrabajo() { return trabajo }

export function hayTrabajoVivo() { return !!trabajo && !trabajo.terminado }

/** El alumno pulsa "Avisame": el bucle sigue solo y notifica al acabar. */
export function pasarASegundoPlano() {
  if (trabajo) { trabajo.segundoPlano = true; avisar() }
}

export function olvidarTrabajo() {
  if (trabajo?.terminado) { trabajo = null; avisar() }
}

// ── Reescalado ────────────────────────────────────────────────────────────

function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('no se pudo decodificar la pagina'))
    img.src = src
  })
}

function b64ABlob(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: 'image/jpeg' })
}

/**
 * Reescala un JPEG en base64 al lado maximo y devuelve un Blob.
 *
 * Si algo falla se devuelve la imagen TAL CUAL, no un error: es una
 * optimizacion, y quedarse sin escaneo por no poder encogerla seria peor que
 * tardar mas. El servidor la reescala igualmente.
 */
export async function reescalar(b64) {
  try {
    const img = await cargarImagen(`data:image/jpeg;base64,${b64}`)
    const lado = Math.max(img.width, img.height)
    if (lado <= LADO_MAX) return b64ABlob(b64)

    const f = LADO_MAX / lado
    const lienzo = document.createElement('canvas')
    lienzo.width = Math.round(img.width * f)
    lienzo.height = Math.round(img.height * f)
    const ctx = lienzo.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height)

    const blob = await new Promise(r => lienzo.toBlob(r, 'image/jpeg', CALIDAD))
    // Liberar el lienzo: 25 paginas seguidas en un movil modesto se notan.
    lienzo.width = lienzo.height = 0
    return blob || b64ABlob(b64)
  } catch {
    return b64ABlob(b64)
  }
}

/**
 * Reintenta una pagina ante un fallo transitorio (un blip de red, una carrera
 * con el refresco del token), que es de lo que mas hay en un movil en clase.
 *
 * NUNCA ante un timeout: subir una pagina no es idempotente. Si la espera se
 * agoto, el servidor puede estar transcribiendola y guardandola ahora mismo, y
 * reenviarla la transcribe otra vez y vuelve a descontar del cupo. Eso es lo
 * que pasaba antes del 2026-09-20: hasta 3 paginas de cupo por pagina real, y
 * el alumno solo veia un error rojo.
 */
async function conReintento(fn, intentos = 2, esperaMs = 1500) {
  let ultimo
  for (let i = 0; i <= intentos; i++) {
    try { return await fn() } catch (e) {
      ultimo = e
      if (e?.timedOut) throw e
      if (i < intentos) await new Promise(r => setTimeout(r, esperaMs))
    }
  }
  throw ultimo
}

// ── La cola ───────────────────────────────────────────────────────────────

/**
 * Encola las paginas de un escaneo y las procesa UNA A UNA: reescalar, subir,
 * siguiente.
 *
 * Por que una peticion por pagina y no todas juntas:
 *  - Se puede decir por donde va ("Subiendo 2 de 4"), que es lo que pedia el
 *    usuario que reporto la lentitud: la espera opaca era la queja de fondo.
 *  - Si falla la pagina 3, las 1 y 2 YA estan guardadas. Antes, un fallo al
 *    final tiraba el escaneo entero.
 *  - No hace falta tocar el endpoint: /notebooks/append ya funde las paginas
 *    del mismo dia en una sola entrada (notebooks.append_entry), y para
 *    "Escanear apuntes" estan document_id y store_original.
 *
 * Por que reescalar y subir INTERCALADOS y no en dos fases:
 *  - Deja encolar un escaneo nuevo mientras hay otro en marcha: se añaden sus
 *    paginas al final y la barra crece sola. Con dos fases globales habria que
 *    decidir que hacer con lo que llega a mitad de la segunda.
 *  - Solo hay UNA pagina reescalada viva a la vez, en memoria. Antes se
 *    escribian todas a disco para no llenar la RAM, y esas copias de sus
 *    apuntes se quedaban en el movil si algo fallaba.
 *
 * @param paginas  array de JPEG en base64, una por pagina escaneada
 * @param campos   {topicId, subjectId, contentType, nombre, modoCuaderno}
 * @returns true si se ha encolado sobre un trabajo que ya estaba en marcha
 */
export function encolarEscaneo(paginas, campos) {
  // Cada escaneo es un LOTE. Importa porque en "Escanear apuntes" las paginas
  // de un mismo lote van al mismo documento (document_id), y las de un lote
  // distinto NO: son otro escaneo, aunque se suban seguidas.
  const lote = { id: ++contadorLote, campos, docId: null }
  const nuevas = paginas.map(b64 => ({ b64, lote }))

  if (hayTrabajoVivo()) {
    trabajo.cola.push(...nuevas)
    trabajo.total += nuevas.length
    avisar()
    return true
  }

  trabajo = {
    cola: nuevas,
    total: nuevas.length,
    fase: 'reescalando',
    actual: 0,
    guardadas: 0,
    terminado: false,
    segundoPlano: false,
    error: null,
    primerResultado: null,
  }
  avisar()
  procesar()   // sin await: quien llama no debe quedarse atado al bucle
  return false
}

async function procesar() {
  try {
    while (trabajo.cola.length) {
      const { b64, lote } = trabajo.cola.shift()
      trabajo.actual = trabajo.guardadas + 1

      trabajo.fase = 'reescalando'; avisar()
      const blob = await reescalar(b64)

      trabajo.fase = 'subiendo'; avisar()
      const c = lote.campos
      const form = new FormData()
      if (c.topicId) form.append('topic_id', c.topicId)
      else if (c.subjectId) form.append('subject_id', c.subjectId)
      form.append('content_type', c.contentType || 'handwritten')
      form.append('file', new File([blob], `${c.nombre}.jpg`, { type: 'image/jpeg' }))
      if (lote.docId) form.append('document_id', lote.docId)
      // La foto de la camara no se conserva en el servidor: solo su texto. No
      // es un archivo que el alumno tenga en el movil y pueda volver a subir,
      // asi que guardarla 10 dias no le aporta nada y nos deja sus apuntes en
      // custodia. Igual que ya hacia "Mi cuaderno".
      if (!c.modoCuaderno) form.append('store_original', 'false')

      const destino = c.modoCuaderno ? '/notebooks/append' : '/documents/upload-image'
      const resp = await conReintento(() => apiUpload(destino, form, null, UPLOAD_TIMEOUT_OCR_MS))

      if (!c.modoCuaderno && !lote.docId) lote.docId = resp?.id || null
      trabajo.guardadas += 1
      if (!trabajo.primerResultado) trabajo.primerResultado = resp
      avisar()
    }
  } catch (e) {
    // Lo que ya se subio SIGUE guardado en el servidor. Se informa de cuanto
    // entro en vez de dar el escaneo entero por perdido.
    trabajo.error = e?.message || String(e)
    console.error('SCAN_UPLOAD_ERROR', trabajo.error, e?.status, e?.timedOut)
  } finally {
    trabajo.terminado = true
    avisar()
    if (trabajo.segundoPlano) await notificarFin(trabajo)
  }
}

/**
 * Aviso local al acabar en segundo plano. Local y no push del servidor a
 * proposito: el servidor atiende cada pagina por separado y no sabe que son un
 * mismo escaneo, asi que quien sabe que ha terminado es el movil.
 */
async function notificarFin(t) {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const perm = await LocalNotifications.requestPermissions()
    if (perm.display !== 'granted') return

    if (LocalNotifications.createChannel) {
      await LocalNotifications.createChannel({
        id: 'scan-done',
        name: i18n.t('mobile.scanner.notifChannel'),
        importance: 4, sound: 'default', vibration: true,
      }).catch(() => {})
    }

    const ok = t.guardadas === t.total && !t.error
    await LocalNotifications.schedule({
      notifications: [{
        // Id fijo y propio: no puede chocar con los recordatorios de examen,
        // que numeran desde 1000 (ver notificationService.js).
        id: 777,
        channelId: 'scan-done',
        title: ok ? i18n.t('mobile.scanner.notifOkTitle') : i18n.t('mobile.scanner.notifPartialTitle'),
        body: ok
          ? i18n.t('mobile.scanner.notifOkBody', { count: t.total })
          : i18n.t('mobile.scanner.notifPartialBody', { done: t.guardadas, total: t.total }),
        schedule: { at: new Date(Date.now() + 500) },
      }],
    })
  } catch {
    // Sin permiso de notificaciones no pasa nada: al volver a la pantalla
    // vera el resultado igual, porque el trabajo sigue en memoria.
  }
}
