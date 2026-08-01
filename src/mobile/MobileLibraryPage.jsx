import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, useAppStore } from '../store/appStore'
import MobileTabBar from './MobileTabBar'
import { IconCamera, IconPhoto, IconFileText, IconBooks, IconFolder, IconFolderOpen, IconTrash, IconHeadphones } from '@tabler/icons-react'

const TYPE_ICON = { escaneado: IconCamera, foto: IconPhoto, pdf: IconFileText }

export default function MobileLibraryPage() {
  const [docs, setDocs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [confirmId, setConfirmId] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [activeSubject, setActiveSubject] = useState(null)
  const [topics, setTopics]     = useState([])
  const [activeTopic, setActiveTopic] = useState(null)
  const { addToast, ttsVoicesPerLang } = useAppStore()
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [docsRes, subjectsRes] = await Promise.all([
        api('GET', '/documents?limit=100&sort=recent'),
        api('GET', '/subjects'),
      ])
      setDocs(docsRes.items || [])
      setSubjects(subjectsRes.items || [])
    } catch {
      addToast('Error al cargar la biblioteca', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Al cambiar de asignatura activa, cargar sus temas (si tiene alguno)
  useEffect(() => {
    setActiveTopic(null)
    if (!activeSubject) { setTopics([]); return }
    api('GET', `/subjects/${activeSubject}/topics`)
      .then(res => setTopics(res.items || []))
      .catch(() => setTopics([]))
  }, [activeSubject])

  const filteredDocs = docs.filter(d => {
    if (activeTopic) return d.topic_id === activeTopic
    if (activeSubject) return d.subject_id === activeSubject
    return true
  })

  async function handleDelete(id) {
    setDeleting(id)
    try {
      await api('DELETE', `/documents/${id}`)
      setDocs(prev => prev.filter(d => d.id !== id))
      addToast('Documento eliminado', 'success')
    } catch {
      addToast('Error al eliminar el documento', 'error')
    } finally {
      setDeleting(null)
      setConfirmId(null)
    }
  }

  const [generatingPodcastId, setGeneratingPodcastId] = useState(null)

  // Reutiliza el mismo "buzón" que ya usa "Mis podcasts" (generar en
  // escritorio/web y recogerlo en el móvil) — aquí se genera y se recoge en
  // el mismo dispositivo, pero es el mismo endpoint y la misma pantalla de
  // descarga, sin duplicar interfaz.
  async function handleGeneratePodcast(doc, e) {
    e.stopPropagation()
    if (generatingPodcastId) return
    setGeneratingPodcastId(doc.id)
    try {
      const podcastVoice = ttsVoicesPerLang?.es || 'es-ES-ElviraNeural'
      await api('POST', `/documents/${doc.id}/podcast/send-to-mobile?voice=${encodeURIComponent(podcastVoice)}`)
      addToast('Podcast generado — ve a "Mis podcasts" para descargarlo', 'success')
    } catch {
      addToast('No se pudo generar el podcast', 'error')
    } finally {
      setGeneratingPodcastId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col pb-20">
      {/* Cabecera */}
      <div className="px-5 pt-14 pb-4 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2"><IconBooks size={22} /> Mis documentos</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          {loading ? 'Cargando...' : `${filteredDocs.length} archivos guardados`}
        </p>
      </div>

      {/* Filtro por asignatura */}
      {!loading && subjects.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-5 py-3 border-b border-slate-800 shrink-0">
          <button
            onClick={() => setActiveSubject(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors
              ${!activeSubject ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400'}`}
          >
            <IconBooks size={13} className="inline -mt-0.5" /> Todos
          </button>
          {subjects.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSubject(activeSubject === s.id ? null : s.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors
                ${activeSubject === s.id ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color }} />
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Filtro por tema (solo si la asignatura activa tiene temas) */}
      {!loading && activeSubject && topics.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-5 py-3 border-b border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTopic(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors
              ${!activeTopic ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
          >
            Todos
          </button>
          {topics.map(topic => (
            <button
              key={topic.id}
              onClick={() => setActiveTopic(activeTopic === topic.id ? null : topic.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors
                ${activeTopic === topic.id ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              <IconFolder size={13} className="inline -mt-0.5" /> {topic.name} <span className="opacity-70">{topic.doc_count}</span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <IconBooks size={44} className="text-slate-600 animate-pulse" />
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
          <IconFolderOpen size={64} className="text-slate-700" />
          <p className="text-slate-200 font-semibold text-lg">Sin documentos</p>
          <p className="text-slate-500 text-sm leading-relaxed">
            {docs.length === 0
              ? 'Escanea apuntes o graba una nota de voz desde la pantalla de inicio'
              : 'No hay documentos con este filtro'}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800">
          {filteredDocs.map(doc => (
            <div
              key={doc.id}
              onClick={() => confirmId !== doc.id && navigate(`/document/${doc.id}`)}
              className="px-5 py-3.5 flex items-start gap-3 active:bg-slate-800/60 transition-colors"
            >
              <span className="shrink-0 mt-0.5 text-slate-400">
                {(() => { const TIcon = TYPE_ICON[doc.file_type] || IconFileText; return <TIcon size={22} /> })()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-100 truncate">{doc.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {doc.subject_name || 'Sin asignatura'}{doc.topic_name && <> · <IconFolder size={11} className="inline -mt-0.5" /> {doc.topic_name}</>} · {doc.pages} págs
                  {doc.has_summary   && <span className="ml-1 text-emerald-500">· ✓ Resumen</span>}
                  {doc.has_flashcards && <span className="ml-1 text-violet-400">· Tarjetas</span>}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {new Date(doc.created_at).toLocaleDateString('es-ES', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>

              {confirmId === doc.id ? (
                <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={deleting === doc.id}
                    className="px-3 py-1.5 rounded-lg bg-red-600 active:bg-red-700 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {deleting === doc.id ? '...' : 'Borrar'}
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 active:bg-slate-600 text-slate-300 text-xs"
                  >
                    No
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={e => handleGeneratePodcast(doc, e)}
                    disabled={generatingPodcastId === doc.id}
                    className="p-2 text-slate-600 active:text-primary-400 transition-colors disabled:opacity-50"
                  >
                    {generatingPodcastId === doc.id ? <IconHeadphones size={18} className="animate-pulse" /> : <IconHeadphones size={18} />}
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmId(doc.id) }}
                    className="p-2 text-slate-600 active:text-red-400 transition-colors"
                  >
                    <IconTrash size={18} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <MobileTabBar />
    </div>
  )
}
