import { useState, useEffect, useRef, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { useAppStore, getAuthHeader } from '../../store/appStore'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configurar el worker de pdf.js.
// El build de Vite (plugin patchPdfjsWorkerPlugin en vite.config.js) inyecta
// automáticamente el polyfill de URL.parse al principio del archivo worker,
// por lo que funciona tanto en web como en Electron 28 (Chrome 120).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export default function PDFViewer({ document: doc, localBase64 = null }) {
  const { apiBase } = useAppStore()
  const [currentPage, setCurrentPage] = useState(1)
  const [numPages, setNumPages]       = useState(null)
  const [blobUrl, setBlobUrl]         = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(false)
  const [containerWidth, setContainerWidth] = useState(null)
  const containerRef = useRef(null)

  // Medir el ancho del contenedor para que la página llene el espacio
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Si hay una copia local (móvil sin conexión, ver offlineDocs.js) se usa
  // directamente esa — sin red de por medio. Si no, se descarga con las
  // cabeceras de auth como siempre y se crea un blob URL.
  useEffect(() => {
    if (!doc?.id) return
    let revoke = null
    setLoading(true)
    setError(false)
    setBlobUrl(null)
    setCurrentPage(1)

    const load = async () => {
      try {
        let blob
        if (localBase64) {
          const bytes = Uint8Array.from(atob(localBase64), c => c.charCodeAt(0))
          blob = new Blob([bytes], { type: 'application/pdf' })
        } else {
          const headers = await getAuthHeader()
          const url = `${apiBase}/documents/${doc.id}/file`
          const res = await fetch(url, { headers })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          blob = await res.blob()
        }
        const objectUrl = URL.createObjectURL(blob)
        revoke = objectUrl
        setBlobUrl(objectUrl)
      } catch (e) {
        console.warn('PDFViewer: no se pudo cargar el PDF', e)
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    load()

    return () => { if (revoke) URL.revokeObjectURL(revoke) }
  }, [doc?.id, apiBase, localBase64])

  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages)
  }, [])

  if (!doc) return null

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <span className="text-slate-500 text-xs animate-pulse">Cargando PDF…</span>
    </div>
  )

  if (error) return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3 text-center">
      <span className="text-4xl">📄</span>
      <p className="text-slate-400 text-sm">No se pudo cargar el PDF</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Barra de navegación */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900 shrink-0">
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          className="btn-ghost btn-icon btn-sm"
        >◀</button>

        <span className="text-xs text-slate-400 flex-1 text-center">
          {currentPage} / {numPages ?? '…'}
        </span>

        <button
          onClick={() => setCurrentPage(p => Math.min(numPages ?? 1, p + 1))}
          disabled={currentPage >= (numPages ?? 1)}
          className="btn-ghost btn-icon btn-sm"
        >▶</button>
      </div>

      {/* Área del PDF — la página llena todo el espacio disponible */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-slate-950 flex justify-center py-2"
      >
        {blobUrl && (
          <Document
            file={blobUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex items-center justify-center h-full">
                <span className="text-slate-500 text-xs animate-pulse">Procesando…</span>
              </div>
            }
          >
            <Page
              pageNumber={currentPage}
              width={containerWidth ? containerWidth - 16 : undefined}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              loading=""
            />
          </Document>
        )}
      </div>

    </div>
  )
}
