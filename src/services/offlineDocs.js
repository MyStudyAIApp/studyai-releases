import { Filesystem, Directory } from '@capacitor/filesystem'
import { Preferences } from '@capacitor/preferences'
import { api, useAppStore, getAuthHeader } from '../store/appStore'

// Descarga de documentos para leer sin conexión en MyStudy App (móvil).
// Mismo patrón que los podcasts (src/mobile/MobilePodcastsPage.jsx): un índice
// ligero en Preferences + el contenido real en un archivo JSON en Directory.Data.
// Estado local y estado en la nube son independientes: quitar la descarga NO
// borra de la nube, y borrar de la nube SÍ limpia la copia local (ver borrar()).

const INDEX_KEY = 'offline_docs_index'

async function readIndex() {
  const { value } = await Preferences.get({ key: INDEX_KEY })
  return value ? JSON.parse(value) : []
}

async function writeIndex(list) {
  await Preferences.set({ key: INDEX_KEY, value: JSON.stringify(list) })
}

export async function listDownloaded() {
  return readIndex()
}

export async function isDownloaded(docId) {
  const list = await readIndex()
  return list.some(d => d.id === docId)
}

function pathFor(docId) {
  return `offline_doc_${docId}.json`
}

function pdfPathFor(docId) {
  return `offline_pdf_${docId}.pdf`
}

// Descarga el binario del PDF original (con las mismas cabeceras de auth que
// usa PDFViewer para verlo online) y lo guarda tal cual en el dispositivo —
// a diferencia del texto/resultados, esto es lo único que de verdad iguala
// la descarga offline del móvil con la del escritorio (que sí conserva el
// archivo real). Capacitor Filesystem escribe binarios en base64.
async function downloadPdfBinary(docId) {
  const { apiBase } = useAppStore.getState()
  const headers = await getAuthHeader()
  const res = await fetch(`${apiBase}/documents/${docId}/file`, { headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
  await Filesystem.writeFile({ path: pdfPathFor(docId), data: base64, directory: Directory.Data })
}

// Descarga metadata + texto + resultados guardados de un documento y lo guarda en local.
export async function downloadDocument(docId) {
  const [doc, text, results] = await Promise.all([
    api('GET', `/documents/${docId}`),
    api('GET', `/documents/${docId}/text`).catch(() => ({ text: '' })),
    api('GET', `/documents/${docId}/results`).catch(() => ({ items: [] })),
  ])

  // Solo tiene sentido intentar el PDF si el documento es de verdad un PDF
  // (file_path real + páginas) -- notas de voz, fotos sueltas o documentos
  // combinados no tienen binario que descargar, solo texto.
  let hasPdf = false
  if (doc.file_path && doc.pages > 0) {
    try {
      await downloadPdfBinary(docId)
      hasPdf = true
    } catch (e) {
      // No bloquea la descarga del texto/resultados si el PDF falla (red
      // lenta, archivo grande) -- el usuario igual puede leer el texto offline.
      console.warn('No se pudo descargar el PDF original para uso offline:', e)
    }
  }

  const payload = { doc, text: text.text || '', results: results.items || [], downloadedAt: Date.now(), hasPdf }
  const path = pathFor(docId)
  await Filesystem.writeFile({ path, data: JSON.stringify(payload), directory: Directory.Data, encoding: 'utf8' })

  const list = await readIndex()
  const entry = { id: docId, title: doc.title, path, downloadedAt: payload.downloadedAt, hasPdf }
  await writeIndex([entry, ...list.filter(d => d.id !== docId)])
  return payload
}

// "Quitar descarga" — solo borra la copia local, la nube no se toca.
export async function removeDownload(docId) {
  const list = await readIndex()
  const entry = list.find(d => d.id === docId)
  if (entry) {
    try { await Filesystem.deleteFile({ path: entry.path, directory: Directory.Data }) } catch { /* ya no existía */ }
    if (entry.hasPdf) {
      try { await Filesystem.deleteFile({ path: pdfPathFor(docId), directory: Directory.Data }) } catch { /* ya no existía */ }
    }
  }
  await writeIndex(list.filter(d => d.id !== docId))
}

// Lee el PDF original ya descargado (base64, listo para pasarlo a PDFViewer).
// Devuelve null si este documento no tiene PDF guardado localmente.
export async function getCachedPdfBase64(docId) {
  const list = await readIndex()
  const entry = list.find(d => d.id === docId)
  if (!entry?.hasPdf) return null
  try {
    const { data } = await Filesystem.readFile({ path: pdfPathFor(docId), directory: Directory.Data })
    return data
  } catch {
    return null
  }
}

// Llamado tras "Borrar" (borrado real en la nube) para no dejar restos locales huérfanos.
export async function cleanupAfterCloudDelete(docId) {
  try { await removeDownload(docId) } catch { /* no había descarga local, nada que limpiar */ }
}

export async function getCached(docId) {
  const list = await readIndex()
  const entry = list.find(d => d.id === docId)
  if (!entry) return null
  try {
    const { data } = await Filesystem.readFile({ path: entry.path, directory: Directory.Data, encoding: 'utf8' })
    return JSON.parse(data)
  } catch {
    return null
  }
}
