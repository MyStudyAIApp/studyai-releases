import { Filesystem, Directory } from '@capacitor/filesystem'
import { Preferences } from '@capacitor/preferences'
import { api } from '../store/appStore'

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

// Descarga metadata + texto + resultados guardados de un documento y lo guarda en local.
export async function downloadDocument(docId) {
  const [doc, text, results] = await Promise.all([
    api('GET', `/documents/${docId}`),
    api('GET', `/documents/${docId}/text`).catch(() => ({ text: '' })),
    api('GET', `/documents/${docId}/results`).catch(() => ({ items: [] })),
  ])

  const payload = { doc, text: text.text || '', results: results.items || [], downloadedAt: Date.now() }
  const path = pathFor(docId)
  await Filesystem.writeFile({ path, data: JSON.stringify(payload), directory: Directory.Data, encoding: 'utf8' })

  const list = await readIndex()
  const entry = { id: docId, title: doc.title, path, downloadedAt: payload.downloadedAt }
  await writeIndex([entry, ...list.filter(d => d.id !== docId)])
  return payload
}

// "Quitar descarga" — solo borra la copia local, la nube no se toca.
export async function removeDownload(docId) {
  const list = await readIndex()
  const entry = list.find(d => d.id === docId)
  if (entry) {
    try { await Filesystem.deleteFile({ path: entry.path, directory: Directory.Data }) } catch { /* ya no existía */ }
  }
  await writeIndex(list.filter(d => d.id !== docId))
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
