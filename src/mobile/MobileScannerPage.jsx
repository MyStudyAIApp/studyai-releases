import { useState, useEffect } from 'react'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Preferences } from '@capacitor/preferences'
import { useNavigate } from 'react-router-dom'
import { api, apiUpload, useAppStore } from '../store/appStore'
import { useDocumentScan } from './useDocumentScan'
import {
  IconArrowLeft, IconCamera, IconPackage, IconCircleCheck, IconPencil, IconBooks,
  IconFolder, IconLoader2, IconRefresh, IconFileText, IconAlertTriangle,
  IconFileTypePdf, IconWriting,
} from '@tabler/icons-react'

// Dónde se persiste el escaneo ANTES de intentar subirlo, en almacenamiento
// propio de la app (Directory.Data) — no en la caché de ML Kit, que Android
// puede borrar en cualquier momento, ni solo en memoria de React, que se
// pierde si el usuario navega fuera de la pantalla o la app se cierra.
const PENDING_META_KEY      = 'pending_scan_meta'
const PENDING_PREVIEW_PATH  = 'pending_scan_preview.jpg'
const PENDING_PDF_PATH      = 'pending_scan.pdf'

async function limpiarPendiente() {
  await Preferences.remove({ key: PENDING_META_KEY })
  try { await Filesystem.deleteFile({ path: PENDING_PREVIEW_PATH, directory: Directory.Data }) } catch { /* no existía */ }
  try { await Filesystem.deleteFile({ path: PENDING_PDF_PATH, directory: Directory.Data }) } catch { /* no existía */ }
}

// Reintenta antes de rendirse — muchos fallos de subida son transitorios
// (un blip de red, una carrera con el refresco del token).
async function withRetry(fn, attempts = 2, delayMs = 1500) {
  let lastErr
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (i < attempts) await new Promise(r => setTimeout(r, delayMs))
    }
  }
  throw lastErr
}

export default function MobileScannerPage() {
  const [previewB64, setPreviewB64] = useState(null)  // JPEG en base64 para mostrar
  const [pdfUri, setPdfUri]         = useState(null)  // PDF file:// URI para subir (ya persistido)
  // Elegido por el alumno ANTES de abrir la cámara -- decide qué IA de OCR se
  // usa al subir (texto impreso: más barata; apuntes a mano: más cauta, sin probar)
  const [contentType, setContentType] = useState(null)  // null | 'printed' | 'handwritten'
  const [docName, setDocName]       = useState('')
  const [loading, setLoading]       = useState(false)
  const [subjects, setSubjects]     = useState([])
  const [subjectId, setSubjectId]   = useState('')
  const [topics, setTopics]         = useState([])
  const [topicId, setTopicId]       = useState('')
  const { scan: docScan, installing, installProgress } = useDocumentScan()
  const { addToast }                = useAppStore()
  const navigate                    = useNavigate()

  // Cargar asignaturas solo una vez, no bloquea el escaneo si falla
  useEffect(() => {
    api('GET', '/subjects').then(res => setSubjects(res.items || [])).catch(() => {})
  }, [])

  // Al elegir asignatura, cargar sus temas (si tiene alguno)
  useEffect(() => {
    setTopicId('')
    if (!subjectId) { setTopics([]); return }
    api('GET', `/subjects/${subjectId}/topics`)
      .then(res => setTopics(res.items || []))
      .catch(() => setTopics([]))
  }, [subjectId])

  // Al abrir la pantalla, comprobar si quedó un escaneo sin guardar de una
  // sesión anterior (subida fallida, cierre inesperado de la app, etc.) y
  // recuperarlo en vez de perderlo silenciosamente.
  useEffect(() => {
    (async () => {
      try {
        const { value } = await Preferences.get({ key: PENDING_META_KEY })
        if (!value) return
        const meta = JSON.parse(value)

        const preview = await Filesystem.readFile({ path: PENDING_PREVIEW_PATH, directory: Directory.Data })
        setPreviewB64(preview.data)
        setDocName(meta.docName || '')
        setContentType(meta.contentType || 'handwritten')

        if (meta.hasPdf) {
          const { uri } = await Filesystem.getUri({ path: PENDING_PDF_PATH, directory: Directory.Data })
          setPdfUri(uri)
        }
        addToast('Recuperado un escaneo que no se llegó a guardar', 'info', 5000)
      } catch {
        // Metadata huérfana sin archivos detrás — limpiar por si acaso
        await limpiarPendiente().catch(() => {})
      }
    })()
  }, [])

  const scan = async () => {
    try {
      const result = await docScan({
        pageLimit: 25,
        galleryImportAllowed: true,
        resultFormats: 'JPEG_PDF',
        scannerMode: 'FULL',
      })
      if (result) await handleScanResult(result)
    } catch (err) {
      if (!err.message?.includes('cancel') && !err.message?.includes('Cancel')) {
        addToast('No se pudo abrir el escáner', 'error')
      }
    }
  }

  const handleScanResult = async (result) => {
    // JPEG de la primera página, para la vista previa
    const { data: previewData } = await Filesystem.readFile({ path: result.scannedImages[0] })

    // Persistir de inmediato en almacenamiento propio de la app — antes de
    // intentar subir nada. Así, si la subida falla o el usuario sale de la
    // pantalla, el escaneo sigue recuperable en el siguiente intento.
    await Filesystem.writeFile({ path: PENDING_PREVIEW_PATH, data: previewData, directory: Directory.Data })

    let persistedPdfUri = null
    if (result.pdf?.uri) {
      const { data: pdfData } = await Filesystem.readFile({ path: result.pdf.uri })
      await Filesystem.writeFile({ path: PENDING_PDF_PATH, data: pdfData, directory: Directory.Data })
      const { uri } = await Filesystem.getUri({ path: PENDING_PDF_PATH, directory: Directory.Data })
      persistedPdfUri = uri
    }

    await Preferences.set({
      key: PENDING_META_KEY,
      value: JSON.stringify({ docName: '', hasPdf: !!persistedPdfUri, contentType, savedAt: Date.now() }),
    })

    setPreviewB64(previewData)
    setPdfUri(persistedPdfUri)
  }

  const chooseAndScan = (type) => {
    setContentType(type)
    scan()
  }

  const fileUriToBlob = async (uri, mimeType) => {
    const { data } = await Filesystem.readFile({ path: uri })
    const binary = atob(data)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: mimeType })
  }

  const guardar = async () => {
    if (!pdfUri && !previewB64) return
    setLoading(true)
    const now = new Date()
    const fecha = now.toLocaleDateString('es-ES')
    const hora  = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    const nombre = docName.trim() || `Escaneo ${fecha} ${hora}`

    // Guardar el nombre elegido en la metadata persistida — si la subida
    // falla, el próximo intento recupera también el nombre que escribió.
    try {
      await Preferences.set({
        key: PENDING_META_KEY,
        value: JSON.stringify({ docName, hasPdf: !!pdfUri, contentType, savedAt: Date.now() }),
      })
    } catch { /* no crítico */ }

    try {
      await withRetry(async () => {
        const form = new FormData()
        if (topicId) form.append('topic_id', topicId)
        else if (subjectId) form.append('subject_id', subjectId)
        form.append('content_type', contentType || 'handwritten')

        if (pdfUri) {
          const blob = await fileUriToBlob(pdfUri, 'application/pdf')
          form.append('file', new File([blob], `${nombre}.pdf`, { type: 'application/pdf' }))
          await apiUpload('/documents/upload', form)
        } else {
          // Fallback: subir la imagen JPEG que ya tenemos en base64
          const binary = atob(previewB64)
          const bytes  = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
          const blob = new Blob([bytes], { type: 'image/jpeg' })
          form.append('file', new File([blob], `${nombre}.jpg`, { type: 'image/jpeg' }))
          await apiUpload('/documents/upload-image', form)
        }
      })

      await limpiarPendiente()
      addToast('¡Apuntes guardados en tu biblioteca!', 'success')
      navigate('/')
    } catch (e) {
      console.error('SCANNER_UPLOAD_ERROR', e?.message ?? String(e), e?.status, e?.name)
      addToast('No se pudo subir — tus páginas siguen aquí, pulsa Guardar para reintentar', 'error', 6000)
    } finally {
      setLoading(false)
    }
  }

  const descartar = async () => {
    await limpiarPendiente().catch(() => {})
    setPreviewB64(null)
    setPdfUri(null)
    setDocName('')
    setSubjectId('')
    setTopicId('')
    setContentType(null)
  }

  const salir = () => {
    if (previewB64 && !window.confirm('¿Salir sin guardar? Vas a perder el escaneo.')) return
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Cabecera */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-5">
        <button onClick={salir} className="text-slate-400 p-1"><IconArrowLeft size={22} /></button>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2"><IconCamera size={20} /> Escanear apuntes</h1>
      </div>

      <div className="flex-1 flex flex-col px-5 gap-5">

        {/* Descargando módulo ML Kit */}
        {installing && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5">
            <IconPackage size={36} className="text-slate-500 animate-bounce" />
            <p className="text-slate-300 font-semibold text-center">
              Preparando el escáner inteligente…
            </p>
            <p className="text-slate-500 text-sm text-center">Solo ocurre la primera vez</p>
            <div className="w-full bg-slate-700 rounded-full h-3">
              <div
                className="bg-primary-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${installProgress}%` }}
              />
            </div>
            <p className="text-slate-400 text-sm">{installProgress}%</p>
          </div>
        )}

        {/* Vista previa del documento escaneado */}
        {!installing && previewB64 && (
          <>
            <div className="rounded-2xl overflow-hidden border border-slate-700 shadow-lg bg-slate-800">
              <img
                src={`data:image/jpeg;base64,${previewB64}`}
                alt="Documento escaneado"
                className="w-full object-contain max-h-[50vh]"
              />
            </div>
            {pdfUri && (
              <p className="text-center text-xs text-emerald-500">✓ Se subirá como PDF con texto extraído</p>
            )}

            <div className="bg-slate-800 rounded-2xl px-4 py-3 flex items-center gap-3 border border-slate-700">
              <IconPencil size={16} className="text-slate-400 shrink-0" />
              <input
                type="text"
                value={docName}
                onChange={e => setDocName(e.target.value)}
                placeholder={(() => { const n = new Date(); return `Escaneo ${n.toLocaleDateString('es-ES')} ${n.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` })()}
                disabled={loading}
                className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 outline-none text-sm"
              />
            </div>

            {subjects.length > 0 && (
              <div className="bg-slate-800 rounded-2xl px-4 py-3 flex items-center gap-3 border border-slate-700">
                <IconBooks size={16} className="text-slate-400 shrink-0" />
                <select
                  value={subjectId}
                  onChange={e => setSubjectId(e.target.value)}
                  disabled={loading}
                  className="flex-1 bg-transparent text-slate-100 outline-none text-sm"
                >
                  <option value="" className="bg-slate-800">Sin asignatura</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id} className="bg-slate-800">{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {subjectId && topics.length > 0 && (
              <div className="bg-slate-800 rounded-2xl px-4 py-3 flex items-center gap-3 border border-slate-700">
                <IconFolder size={16} className="text-slate-400 shrink-0" />
                <select
                  value={topicId}
                  onChange={e => setTopicId(e.target.value)}
                  disabled={loading}
                  className="flex-1 bg-transparent text-slate-100 outline-none text-sm"
                >
                  <option value="" className="bg-slate-800">Sin tema (suelto)</option>
                  {topics.map(topic => (
                    <option key={topic.id} value={topic.id} className="bg-slate-800">{topic.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={guardar}
              disabled={loading}
              className="w-full py-5 rounded-2xl bg-primary-600 text-white font-bold text-lg
                         active:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {loading
                ? <span className="flex items-center justify-center gap-2"><IconLoader2 size={18} className="animate-spin" /> Guardando...</span>
                : <span className="flex items-center justify-center gap-2"><IconCircleCheck size={18} /> Guardar en biblioteca</span>}
            </button>
            <button
              onClick={descartar}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-slate-700 text-slate-300 font-medium
                         active:bg-slate-600 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              <IconRefresh size={16} /> Escanear otra vez
            </button>
          </>
        )}

        {/* Elegir tipo de contenido ANTES de abrir la cámara */}
        {!installing && !previewB64 && !contentType && (
          <>
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-2">
              <IconCamera size={40} className="text-slate-500 mb-2" />
              <p className="text-slate-300 font-semibold">¿Qué vas a escanear?</p>
              <p className="text-slate-500 text-sm px-4">Así elegimos la mejor forma de leerlo</p>
            </div>

            <button
              onClick={() => chooseAndScan('printed')}
              className="w-full py-5 rounded-2xl bg-slate-800 border border-slate-700 active:bg-slate-700
                         flex items-center gap-3 px-5 transition-colors"
            >
              <IconFileTypePdf size={28} className="text-sky-400 shrink-0" />
              <span className="text-left">
                <span className="block text-slate-100 font-semibold">Texto impreso</span>
                <span className="block text-slate-500 text-xs">Libro, apuntes fotocopiados, PDF impreso</span>
              </span>
            </button>

            <button
              onClick={() => chooseAndScan('handwritten')}
              className="w-full py-5 rounded-2xl bg-slate-800 border border-slate-700 active:bg-slate-700
                         flex items-center gap-3 px-5 transition-colors"
            >
              <IconWriting size={28} className="text-amber-400 shrink-0" />
              <span className="text-left">
                <span className="block text-slate-100 font-semibold">Apuntes a mano</span>
                <span className="block text-slate-500 text-xs">Tu propia letra manuscrita</span>
              </span>
            </button>

            <p className="flex items-center justify-center gap-1.5 text-xs text-amber-500/80 text-center px-4">
              <IconAlertTriangle size={14} className="shrink-0" /> No escanees datos personales sensibles (DNI, nombres de terceros, etc.)
            </p>
          </>
        )}

        {/* Estado inicial (ya elegido el tipo, listo para escanear) */}
        {!installing && !previewB64 && contentType && (
          <>
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full h-52 rounded-2xl border-2 border-dashed border-slate-600
                              flex flex-col items-center justify-center gap-3 text-slate-500">
                <IconFileText size={44} />
                <span className="text-sm text-center px-4">
                  Coloca el folio bien iluminado y pulsa el botón
                </span>
              </div>
            </div>

            <p className="flex items-center justify-center gap-1.5 text-xs text-amber-500/80 text-center px-4">
              <IconAlertTriangle size={14} className="shrink-0" /> No escanees datos personales sensibles (DNI, nombres de terceros, etc.)
            </p>

            <button
              onClick={scan}
              className="w-full py-6 rounded-2xl bg-primary-600 text-white font-bold text-xl
                         active:bg-primary-700 transition-colors flex items-center justify-center gap-3 shadow-lg"
            >
              <IconCamera size={28} /> Escanear documento
            </button>

            <button
              onClick={() => setContentType(null)}
              className="w-full text-slate-500 text-xs text-center"
            >
              ← Cambiar tipo de contenido
            </button>
          </>
        )}
      </div>

      <p className="text-center text-xs text-slate-600 py-5 px-6">
        El escáner detecta los bordes del folio automáticamente y recorta solo el documento.
      </p>
    </div>
  )
}
