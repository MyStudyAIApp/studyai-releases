import { useState, useEffect, useRef, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { useAppStore, getAuthHeader, getLocalAuthHeader } from '../../store/appStore'
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
  const [visiblePage, setVisiblePage] = useState(1)
  const [numPages, setNumPages]       = useState(null)
  const [blobUrl, setBlobUrl]         = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(false)
  const [containerWidth, setContainerWidth] = useState(null)
  const containerRef = useRef(null)
  const pageRefs = useRef([])

  const scrollToPage = (n) => {
    pageRefs.current[n - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

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
    setVisiblePage(1)
    pageRefs.current = []

    const load = async () => {
      try {
        let blob
        if (localBase64) {
          const bytes = Uint8Array.from(atob(localBase64), c => c.charCodeAt(0))
          blob = new Blob([bytes], { type: 'application/pdf' })
        } else {
          const [headers, localHeader] = await Promise.all([getAuthHeader(), getLocalAuthHeader()])
          const url = `${apiBase}/documents/${doc.id}/file`
          const res = await fetch(url, { headers: { ...headers, ...localHeader } })
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

  // Actualiza el indicador "X / Y" según la página que esté cruzando la
  // parte superior del área visible mientras el usuario hace scroll -- el
  // visor ya no muestra una sola página con botones, sino todas seguidas.
  useEffect(() => {
    if (!numPages || !containerRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length === 0) return
        const top = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b))
        const idx = pageRefs.current.indexOf(top.target)
        if (idx !== -1) setVisiblePage(idx + 1)
      },
      { root: containerRef.current, rootMargin: '0px 0px -70% 0px', threshold: 0 }
    )
    pageRefs.current.forEach(el => el && observer.observe(el))
    return () => observer.disconnect()
  }, [numPages, blobUrl])

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
    <div className="flex flex-col h-full min-h-0 overflow-hidden">

      {/* Barra de navegación -- salta a una página, el scroll real es continuo abajo */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900 shrink-0">
        <button
          onClick={() => scrollToPage(Math.max(1, visiblePage - 1))}
          disabled={visiblePage <= 1}
          className="btn-ghost btn-icon btn-sm"
        >◀</button>

        <span className="text-xs text-slate-400 flex-1 text-center">
          {visiblePage} / {numPages ?? '…'}
        </span>

        <button
          onClick={() => scrollToPage(Math.min(numPages ?? 1, visiblePage + 1))}
          disabled={visiblePage >= (numPages ?? 1)}
          className="btn-ghost btn-icon btn-sm"
        >▶</button>
      </div>

      {/* Área del PDF — todas las páginas seguidas, con scroll continuo */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-auto bg-slate-950 flex flex-col items-center py-2 gap-2"
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
            {numPages && Array.from({ length: numPages }, (_, i) => (
              <div key={i} ref={el => { pageRefs.current[i] = el }}>
                <Page
                  pageNumber={i + 1}
                  width={containerWidth ? containerWidth - 16 : undefined}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                  loading=""
                />
              </div>
            ))}
          </Document>
        )}
      </div>

    </div>
  )
}
