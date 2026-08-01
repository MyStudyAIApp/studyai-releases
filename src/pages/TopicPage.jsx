import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppStore, api, apiUpload, apiStream } from '../store/appStore'
import Spinner from '../components/UI/Spinner'
import ResultPanel from '../components/Results/ResultPanel'
import ActionPanel from '../components/Actions/ActionPanel'
import { useTranslation } from 'react-i18next'
import { IconArrowLeft, IconFolder, IconPhoto, IconCamera, IconFileText } from '@tabler/icons-react'

export default function TopicPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { addToast, backendReady } = useAppStore()
  const navigate = useNavigate()

  const [topic, setTopic] = useState(null)
  const [docs, setDocs] = useState([])
  const [selectedDocs, setSelectedDocs] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const [generating, setGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState('')
  const [result, setResult] = useState(null)
  const [activeAction, setActiveAction] = useState(null)
  const [streamedText, setStreamedText] = useState('')

  const fileInputRef = useRef()

  useEffect(() => {
    if (!backendReady || !id) return
    loadData()
  }, [id, backendReady])

  async function loadData() {
    setLoading(true)
    try {
      const [topicData, d] = await Promise.all([
        api('GET', `/topics/${id}`),
        api('GET', `/documents?topic_id=${id}`),
      ])
      setTopic(topicData)
      const items = d.items || []
      setDocs(items)
      setSelectedDocs(new Set(items.map(doc => doc.id)))  // todos marcados por defecto
    } catch (e) {
      addToast(t('topicPage.loadError'), 'error')
      navigate('/library')
    } finally {
      setLoading(false)
    }
  }

  function toggleDoc(docId) {
    setSelectedDocs(prev => {
      const next = new Set(prev)
      next.has(docId) ? next.delete(docId) : next.add(docId)
      return next
    })
  }

  async function handleUpload(files) {
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('topic_id', id)
      try {
        const endpoint = file.type === 'application/pdf' ? '/documents/upload' : '/documents/upload-image'
        const doc = await apiUpload(endpoint, fd)
        addToast(t('topicPage.docAdded', { name: doc.title }), 'success')
      } catch (e) {
        addToast(t('topicPage.errorImporting', { name: file.name, error: e.message }), 'error')
      }
    }
    setUploading(false)
    loadData()
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length) handleUpload(files)
  }

  async function generate(action, params = {}) {
    const docIds = [...selectedDocs]
    if (docIds.length === 0) {
      addToast(t('topicPage.selectAtLeastOne'), 'warning')
      return
    }
    setActiveAction(action)
    setGenerating(true)
    setResult(null)
    setStreamedText('')
    const controller = new AbortController()

    try {
      setGenProgress(t('document.analyzing'))
      let fullText = ''
      let finalResult = null

      await apiStream(
        `/generate/${action}`,
        { document_id: docIds[0], doc_ids: docIds, ...params },
        (chunk) => {
          if (chunk.progress) setGenProgress(chunk.progress)
          if (chunk.text) {
            fullText += chunk.text
            setStreamedText(fullText)
          }
          if (chunk.result) {
            finalResult = chunk.result
            setResult(chunk.result)
            setStreamedText('')
          }
        },
        controller.signal
      )
      if (!finalResult && fullText) {
        setResult({ type: action, content: fullText })
      }
    } catch (e) {
      if (e.name !== 'AbortError') addToast(`Error: ${e.message}`, 'error')
    } finally {
      setGenerating(false)
      setGenProgress('')
    }
  }

  if (loading) return <div className="flex justify-center items-center h-full"><Spinner label={t('topicPage.loading')} /></div>
  if (!topic) return null

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden overflow-y-auto md:overflow-y-hidden">
      {/* Documentos del tema — 40% en escritorio, fila apilada en móvil */}
      <div
        className={`w-full md:w-[40%] border-b md:border-b-0 md:border-r border-slate-800 flex flex-col md:overflow-hidden shrink-0 max-h-[50vh] md:max-h-none relative ${dragOver ? 'bg-primary-900/10' : ''}`}
        onDragOver={e => { e.preventDefault(); if (Array.from(e.dataTransfer.types).includes('Files')) setDragOver(true) }}
        onDragLeave={e => { if (e.currentTarget === e.target) setDragOver(false) }}
        onDrop={handleDrop}
      >
        {dragOver && (
          <div className="absolute inset-2 z-20 rounded-2xl border-2 border-dashed border-primary-500 bg-primary-950/40 flex items-center justify-center pointer-events-none">
            <p className="text-primary-300 font-semibold text-sm text-center px-4">Suelta el PDF o la foto para añadirlo al tema</p>
          </div>
        )}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
          <button onClick={() => navigate('/library')} className="btn-ghost btn-icon btn-sm"><IconArrowLeft size={16} /></button>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-slate-100 truncate text-sm flex items-center gap-1.5"><IconFolder size={15} className="shrink-0" /> {topic.name}</h2>
            {topic.subject_name && <span className="badge-blue text-[10px]">{topic.subject_name}</span>}
          </div>
        </div>

        <div className="px-4 py-3 border-b border-slate-800 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            multiple
            className="hidden"
            onChange={e => handleUpload(Array.from(e.target.files))}
          />
          <button onClick={() => fileInputRef.current.click()} className="btn-primary btn-sm w-full" disabled={uploading}>
            {uploading ? t('topicPage.uploading') : t('topicPage.addDocs')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
              <IconFolder size={36} className="text-slate-600" />
              <p className="text-slate-400 text-sm">{t('topicPage.noDocsYet')}</p>
              <p className="text-slate-500 text-xs">{t('topicPage.noDocsHint')}</p>
            </div>
          ) : docs.map(doc => (
            <div
              key={doc.id}
              className="group flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
              onClick={() => navigate(`/document/${doc.id}`)}
            >
              <div onClick={e => { e.stopPropagation(); toggleDoc(doc.id) }} className="shrink-0">
                <input
                  type="checkbox"
                  checked={selectedDocs.has(doc.id)}
                  onChange={() => {}}
                  className="w-4 h-4 rounded accent-primary-500 cursor-pointer"
                />
              </div>
              <span className="shrink-0 text-slate-400">
                {doc.file_type === 'foto' ? <IconPhoto size={18} /> : doc.file_type === 'escaneado' ? <IconCamera size={18} /> : <IconFileText size={18} />}
              </span>
              <span className="text-sm text-slate-200 truncate flex-1">{doc.title}</span>
            </div>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-slate-800 text-xs text-slate-500 shrink-0">
          {t(docs.length === 1 ? 'topicPage.selectedFooter' : 'topicPage.selectedFooterPlural', { selected: selectedDocs.size, total: docs.length })}
        </div>
      </div>

      {/* Action Panel — 18% en escritorio, ancho completo en móvil */}
      <div className="w-full md:w-[18%] border-b md:border-b-0 md:border-r border-slate-800 md:overflow-y-auto shrink-0">
        <ActionPanel
          doc={{ id: [...selectedDocs][0] }}
          onGenerate={generate}
          generating={generating}
          activeAction={activeAction}
        />
      </div>

      {/* Result Panel — 42% en escritorio, ancho completo en móvil */}
      <div className="flex-1 min-h-[60vh] md:min-h-0 overflow-hidden flex flex-col">
        <ResultPanel
          result={result}
          streamedText={streamedText}
          generating={generating}
          genProgress={genProgress}
          doc={{ id: [...selectedDocs][0], title: topic.name }}
          activeAction={activeAction}
          onSaved={() => {}}
        />
      </div>
    </div>
  )
}
