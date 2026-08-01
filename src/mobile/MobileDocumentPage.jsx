import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, useAppStore } from '../store/appStore'
import {
  IconArrowLeft, IconCamera, IconPhoto, IconFileText, IconFolder, IconMoodSad,
  IconLoader2, IconPaperclip,
} from '@tabler/icons-react'

const TYPE_ICON = { escaneado: IconCamera, foto: IconPhoto, pdf: IconFileText }

export default function MobileDocumentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useAppStore()

  const [doc, setDoc]         = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  const [openingFile, setOpeningFile] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    api('GET', `/documents/${id}`)
      .then(data => { if (!cancelled) setDoc(data) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  // El texto guardado es lo que "ve" la IA — sirve para comprobar que el
  // escaneo/OCR o la transcripción de voz salieron bien.
  const tieneArchivoOriginal = !!doc?.file_path && doc.file_path.includes('/')

  const verOriginal = async () => {
    setOpeningFile(true)
    try {
      const { url } = await api('GET', `/documents/${id}/file-url`)
      window.open(url, '_blank')
    } catch {
      addToast('No se pudo abrir el documento original', 'error')
    } finally {
      setOpeningFile(false)
    }
  }

  const copiarTexto = async () => {
    try {
      await navigator.clipboard.writeText(doc?.text_content || '')
      addToast('Texto copiado', 'success')
    } catch {
      addToast('No se pudo copiar', 'error')
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Cabecera */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-slate-800">
        <button onClick={() => navigate(-1)} className="text-slate-400 p-1 shrink-0"><IconArrowLeft size={22} /></button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-100 truncate flex items-center gap-1.5">
            {doc && (() => { const TIcon = TYPE_ICON[doc.file_type] || IconFileText; return <TIcon size={17} className="shrink-0" /> })()}
            {doc ? doc.title : 'Documento'}
          </h1>
          {doc && (
            <p className="text-xs text-slate-500 mt-0.5">
              {doc.subject_name || 'Sin asignatura'}{doc.topic_name && <> · <IconFolder size={11} className="inline -mt-0.5" /> {doc.topic_name}</>} · {doc.pages} págs · {new Date(doc.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <IconFileText size={36} className="text-slate-600 animate-pulse" />
        </div>
      )}

      {!loading && error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
          <IconMoodSad size={56} className="text-slate-600" />
          <p className="text-slate-300 font-semibold">No se pudo cargar el documento</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-2 px-5 py-2.5 rounded-xl bg-slate-700 active:bg-slate-600 text-slate-200 text-sm font-medium"
          >
            Volver
          </button>
        </div>
      )}

      {!loading && !error && doc && (
        <div className="flex-1 overflow-y-auto px-5 py-4 pb-10">
          {tieneArchivoOriginal && (
            <button
              onClick={verOriginal}
              disabled={openingFile}
              className="w-full mb-4 py-3.5 rounded-2xl bg-primary-600 active:bg-primary-700
                         text-white font-semibold text-sm disabled:opacity-50 transition-colors
                         flex items-center justify-center gap-2"
            >
              {openingFile
                ? <span className="flex items-center justify-center gap-2"><IconLoader2 size={16} className="animate-spin" /> Abriendo...</span>
                : <span className="flex items-center justify-center gap-2"><IconPaperclip size={16} /> Ver documento original</span>}
            </button>
          )}

          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Texto extraído
            </p>
            {!!doc.text_content && (
              <button onClick={copiarTexto} className="text-xs text-primary-400 active:text-primary-300">
                Copiar
              </button>
            )}
          </div>

          {doc.text_content ? (
            <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
              <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
                {doc.text_content}
              </p>
            </div>
          ) : (
            <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700 text-center">
              <p className="text-slate-500 text-sm">
                No se extrajo texto de este documento.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
