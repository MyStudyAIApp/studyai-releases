import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { useAppStore, api, apiStream, IS_WEB, IS_MOBILE } from '../store/appStore'
import Spinner from '../components/UI/Spinner'
import ResultPanel from '../components/Results/ResultPanel'
import ActionPanel from '../components/Actions/ActionPanel'
import PDFViewer from '../components/PDF/PDFViewer'
import TextToSpeech from '../components/Audio/TextToSpeech'
import PodcastPanel from '../components/Audio/PodcastPanel'
import Modal from '../components/UI/Modal'
import { useTranslation } from 'react-i18next'
import { getCached as getCachedOfflineDoc, getCachedPdfBase64 } from '../services/offlineDocs'
import { ensureMathDelimiters } from '../utils/mathText'

const TEXT_MD_OPTS = { remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex] }
import {
  IconLoader2, IconVolume, IconHeadphones, IconArrowLeft, IconFileText,
  IconBooks, IconFolder, IconChevronUp, IconChevronDown, IconSparkles, IconX, IconWifiOff,
} from '@tabler/icons-react'

// Lazy-loading TTS for the full PDF document text
function DocTTS({ docId, chunks, onChunksLoaded }) {
  const { t } = useTranslation()
  const { apiBase, addToast } = useAppStore()
  const [fetching, setFetching] = useState(false)

  async function handleClick() {
    // If chunks not loaded yet, fetch them first, then TextToSpeech will play
    if (!chunks) {
      setFetching(true)
      try {
        const r = await api('GET', `/documents/${docId}/text`)
        onChunksLoaded(r.chunks || [])
      } catch (e) {
        addToast(t('document.loadTextError'), 'error')
      } finally {
        setFetching(false)
      }
    }
  }

  if (fetching) {
    return (
      <button className="btn-secondary btn-sm text-base" disabled title={t('document.loadingText')}>
        <IconLoader2 size={16} className="animate-spin" />
      </button>
    )
  }

  if (!chunks) {
    // Not yet loaded — show a plain button that triggers the fetch
    return (
      <button
        onClick={handleClick}
        className="btn-secondary btn-sm text-base"
        title={t('document.readAloud')}
      >
        <IconVolume size={16} />
      </button>
    )
  }

  // Chunks loaded — hand off to the full TextToSpeech component
  return <TextToSpeech chunks={chunks} />
}

function TextViewer({ docId, title, cachedText }) {
  const { t } = useTranslation()
  const [text, setText] = useState(cachedText ?? null)
  const [loading, setLoading] = useState(cachedText == null)

  useEffect(() => {
    if (cachedText != null) { setText(cachedText); setLoading(false); return }
    api('GET', `/documents/${docId}/text`)
      .then(r => setText((r.chunks || []).join('\n\n')))
      .catch(() => setText(''))
      .finally(() => setLoading(false))
  }, [docId, cachedText])

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <Spinner label={t('document.loadingText')} />
    </div>
  )

  if (!text) return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3 text-center">
      <IconFileText size={40} className="text-slate-600" />
      <p className="text-slate-400 text-sm">{t('document.noText')}</p>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/50 shrink-0">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{t('document.transcription')}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {/* Cada línea como su propio párrafo, para conservar los saltos de
            línea (ej. los pasos de un ejercicio guardado) — si no, Markdown
            fusiona líneas sueltas en un solo párrafo. */}
        <div className="prose-studyai text-sm text-slate-300 leading-relaxed">
          <ReactMarkdown {...TEXT_MD_OPTS}>
            {ensureMathDelimiters(text).replace(/\n/g, '\n\n')}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

// Anchos de los 3 paneles del escritorio (documento / generar / resultado),
// recordados entre sesiones para que cada quien deje su distribución preferida.
const LAYOUT_KEY = 'studyai_document_layout_widths'
const DEFAULT_WIDTHS = { docWidth: 480, actionsWidth: 220 }

function loadLayoutWidths() {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    if (raw) return { ...DEFAULT_WIDTHS, ...JSON.parse(raw) }
  } catch { /* ignorar */ }
  return { ...DEFAULT_WIDTHS }
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max)
}

export default function DocumentPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { addToast, backendReady } = useAppStore()
  const [doc, setDoc] = useState(null)
  const [isOfflineCache, setIsOfflineCache] = useState(false)
  const [offlineText, setOfflineText] = useState(null)
  const [offlinePdfBase64, setOfflinePdfBase64] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState('')
  const [result, setResult] = useState(null)
  const [activeAction, setActiveAction] = useState(null)
  const [streamedText, setStreamedText] = useState('')
  const [savedResults, setSavedResults] = useState([])
  const [showSaved, setShowSaved] = useState(false)
  const [docChunks, setDocChunks] = useState(null)   // null = not loaded yet
  const navigate = useNavigate()
  const location = useLocation()
  const [showPodcastModal, setShowPodcastModal] = useState(() => !!location.state?.openPodcast)
  const [mobilePanel, setMobilePanel] = useState('pdf')  // 'pdf' | 'result'
  const [showActionSheet, setShowActionSheet] = useState(false)
  // Mismo criterio que Layout.jsx: la app Capacitor completa (IS_MOBILE) es
  // siempre "estrecha", sin importar el ancho de ventana; web solo cuando la
  // pantalla es realmente estrecha.
  const [isMobileWeb, setIsMobileWeb] = useState(() => IS_MOBILE || (IS_WEB && window.innerWidth < 768))

  // Anchos de paneles (documento/generar), redimensionables arrastrando el
  // separador entre ellos. El panel de resultado ocupa siempre el resto.
  const [docWidth, setDocWidth]         = useState(() => loadLayoutWidths().docWidth)
  const [actionsWidth, setActionsWidth] = useState(() => loadLayoutWidths().actionsWidth)
  const docWidthRef     = useRef(docWidth)
  const actionsWidthRef = useRef(actionsWidth)
  useEffect(() => { docWidthRef.current = docWidth }, [docWidth])
  useEffect(() => { actionsWidthRef.current = actionsWidth }, [actionsWidth])

  function saveLayoutWidths() {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify({
        docWidth: docWidthRef.current,
        actionsWidth: actionsWidthRef.current,
      }))
    } catch { /* no crítico */ }
  }

  // Arrastrar el separador entre paneles -- `which` indica cuál de los dos
  // anchos ajustar (el tercer panel, resultado, siempre ocupa lo que sobra).
  function startResize(which) {
    return (e) => {
      e.preventDefault()
      const startX        = e.clientX
      const startDocW      = docWidthRef.current
      const startActionsW  = actionsWidthRef.current
      function onMove(ev) {
        const delta = ev.clientX - startX
        if (which === 'doc') setDocWidth(clamp(startDocW + delta, 300, 900))
        else setActionsWidth(clamp(startActionsW + delta, 160, 420))
      }
      function onUp() {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        saveLayoutWidths()
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    }
  }

  useEffect(() => {
    if (!IS_WEB) return
    const handler = () => setIsMobileWeb(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Auto-load result when navigating from multi-summary generation
  useEffect(() => {
    if (location.state?.autoResult) {
      const action = location.state.autoAction || 'summary'
      setResult({ ...location.state.autoResult, type: action })
      setActiveAction(action)
      if (isMobileWeb) setMobilePanel('result')
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state?.autoResult])

  useEffect(() => {
    if (!backendReady || !id) return
    Promise.all([
      api('GET', `/documents/${id}`),
      api('GET', `/documents/${id}/results`),
    ])
      .then(([d, r]) => {
        setDoc(d)
        setSavedResults(r.items || [])
        setIsOfflineCache(false)
        setOfflinePdfBase64(null)
      })
      .catch(async () => {
        // Sin conexión (o el servidor no responde): si es MyStudy App y este
        // documento se descargó antes, mostrar la copia local en vez de fallar.
        if (IS_MOBILE) {
          const cached = await getCachedOfflineDoc(id).catch(() => null)
          if (cached) {
            setDoc(cached.doc)
            setSavedResults(cached.results || [])
            setOfflineText(cached.text || '')
            setIsOfflineCache(true)
            if (cached.hasPdf) {
              const pdfBase64 = await getCachedPdfBase64(id).catch(() => null)
              setOfflinePdfBase64(pdfBase64)
            }
            return
          }
        }
        addToast(t('document.notFound'), 'error')
        navigate('/library')
      })
      .finally(() => setLoading(false))
  }, [id, backendReady])

  async function generate(action, params = {}) {
    setActiveAction(action)
    setGenerating(true)
    setResult(null)
    setStreamedText('')
    setShowSaved(false)
    const controller = new AbortController()

    try {
      setGenProgress(t('document.analyzing'))
      let fullText = ''
      let finalResult = null

      await apiStream(
        `/generate/${action}`,
        { document_id: id, ...params },
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
      if (finalResult || fullText) {
        addToast(t('document.generatedOk', { action: t(`document.actions.${action}`) || action }), 'success')
      }
    } catch (e) {
      if (e.name !== 'AbortError' && !e.quotaExceeded) addToast(`Error: ${e.message}`, 'error')
    } finally {
      setGenerating(false)
      setGenProgress('')
    }
  }

  async function handleSaveResult(savedResult, action) {
    const r = await api('GET', `/documents/${id}/results`)
    setSavedResults(r.items || [])
  }

  function handlePrepDay(day, action) {
    const dateStr = day.date
      ? new Date(day.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
      : `Día ${action}`
    const topicsList = (day.topics || []).join(', ')
    const context = `IMPORTANTE: Genera contenido SOLO sobre estos temas específicos del día "${dateStr}":\n${topicsList}\n\nNo te salgas de estos temas concretos.`
    generate(action, { context_override: context })
  }

  function loadSaved(item) {
    setResult({ ...item.data, type: item.type })
    setActiveAction(item.type)
    setShowSaved(false)
  }

  if (loading) return <div className="flex justify-center items-center h-full"><Spinner label={t('document.loading')} /></div>
  if (!doc) return null

  // Reutilizado en mobile y desktop
  const docViewerEl = (
    isOfflineCache && offlinePdfBase64
      ? <PDFViewer document={doc} localBase64={offlinePdfBase64} />
      : isOfflineCache || doc.title?.startsWith('[Clase]') || doc.title?.startsWith('[Foto]') || !doc.file_path
        ? <TextViewer docId={doc.id} title={doc.title} cachedText={isOfflineCache ? offlineText : undefined} />
        : IS_WEB && !doc.file_path.includes('/')
          ? <TextViewer docId={doc.id} title={doc.title} cachedText={isOfflineCache ? offlineText : undefined} />
          : doc.pages > 0
            ? <PDFViewer document={doc} />
            : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 text-center">
              <IconBooks size={44} className="text-slate-600" />
              <p className="text-slate-300 font-semibold text-sm">{doc.title}</p>
              <p className="text-slate-500 text-xs leading-relaxed">
                {t('document.combinedFrom', { count: doc.pages })}<br />
                {t('document.combinedHint')}
              </p>
            </div>
          )
  )

  const savedResultsBar = savedResults.length > 0 && (
    <div className="px-3 py-2 border-b border-slate-800 shrink-0">
      <button
        onClick={() => setShowSaved(v => !v)}
        className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors"
      >
        <span className="flex items-center gap-1.5"><IconFolder size={14} /> {t('document.savedResults')} ({savedResults.length})</span>
        {showSaved ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
      </button>
      {showSaved && (
        <div className="mt-2 space-y-1">
          {savedResults.map(item => (
            <button
              key={item.id}
              onClick={() => { loadSaved(item); if (isMobileWeb) setMobilePanel('result') }}
              className="w-full text-left px-2 py-1.5 rounded text-xs text-slate-300 hover:bg-slate-700 transition-colors flex items-center justify-between gap-2"
            >
              <span className="truncate">{item.data?.name || t(`document.actions.${item.type}`) || item.type}</span>
              <span className="text-slate-500 shrink-0">{new Date(item.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  const podcastModalEl = (
    <Modal open={showPodcastModal} onClose={() => setShowPodcastModal(false)} title={t('document.podcastModalTitle')} size="sm">
      <PodcastPanel doc={doc} onClose={() => setShowPodcastModal(false)} />
    </Modal>
  )

  // ── Mobile web: PDF first → result full screen ────────────────────────────
  if (isMobileWeb) {
    return (
      <div className="flex flex-col h-full overflow-hidden relative">

        {mobilePanel === 'pdf' ? (
          <>
            <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2 shrink-0">
              <button onClick={() => navigate('/library')} className="btn-ghost btn-icon btn-sm"><IconArrowLeft size={16} /></button>
              <h2 className="font-semibold text-slate-100 truncate text-sm flex-1">{doc.title}</h2>
              {doc.subject_name && <span className="badge-blue shrink-0">{doc.subject_name}</span>}
              <button
                onClick={() => setShowPodcastModal(true)}
                className="btn-ghost btn-icon btn-sm shrink-0"
                title={t('document.podcastButton')}
              >
                <IconHeadphones size={16} />
              </button>
            </div>
            {isOfflineCache && (
              <div className="px-4 py-2 bg-amber-900/30 border-b border-amber-800/50 text-amber-300 text-xs flex items-center gap-1.5 shrink-0">
                <IconWifiOff size={13} /> Sin conexión — viendo la copia guardada en el móvil. No se puede generar contenido nuevo.
              </div>
            )}
            {savedResultsBar}
            <div className="flex-1 overflow-hidden">{docViewerEl}</div>
            {!isOfflineCache && (
              <button
                onClick={() => setShowActionSheet(true)}
                className="absolute bottom-5 right-4 bg-primary-600 hover:bg-primary-500 active:bg-primary-700 text-white font-semibold px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-2 z-10"
              >
                <IconSparkles size={18} /> Generar contenido
              </button>
            )}
          </>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2 shrink-0">
              <button onClick={() => setMobilePanel('pdf')} className="btn-ghost btn-icon btn-sm"><IconArrowLeft size={16} /></button>
              <h2 className="font-semibold text-slate-100 text-sm flex-1 truncate">
                {activeAction ? (t(`actionPanel.items.${activeAction}`) || activeAction) : 'Resultado'}
              </h2>
              <button onClick={() => navigate('/library')} className="text-xs text-slate-500 hover:text-slate-300 shrink-0">
                Biblioteca
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <ResultPanel
                result={result}
                streamedText={streamedText}
                generating={generating}
                genProgress={genProgress}
                doc={doc}
                activeAction={activeAction}
                onSaved={handleSaveResult}
                onPrepDay={handlePrepDay}
              />
            </div>
          </>
        )}

        {/* Bottom sheet de acciones */}
        {showActionSheet && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowActionSheet(false)} />
            <div className="relative bg-slate-900 rounded-t-3xl overflow-hidden max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 shrink-0">
                <span className="font-semibold text-slate-100">Generar contenido</span>
                <button onClick={() => setShowActionSheet(false)} className="text-slate-400 leading-none"><IconX size={20} /></button>
              </div>
              <div className="overflow-y-auto flex-1">
                <ActionPanel
                  doc={doc}
                  onGenerate={(action, params) => {
                    setShowActionSheet(false)
                    setMobilePanel('result')
                    generate(action, params)
                  }}
                  generating={generating}
                  activeAction={activeAction}
                />
              </div>
            </div>
          </div>
        )}

        {podcastModalEl}
      </div>
    )
  }

  // ── Desktop layout ────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">
      {/* PDF / Texto */}
      <div style={{ width: docWidth }} className="flex flex-col overflow-hidden shrink-0">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
          <button onClick={() => navigate('/library')} className="btn-ghost btn-icon btn-sm"><IconArrowLeft size={16} /></button>
          <h2 className="font-semibold text-slate-100 truncate text-sm flex-1">{doc.title}</h2>
          {doc.subject_name && <span className="badge-blue shrink-0">{doc.subject_name}</span>}
          <DocTTS docId={doc.id} chunks={docChunks} onChunksLoaded={setDocChunks} />
          <button
            onClick={() => setShowPodcastModal(true)}
            className="btn-secondary btn-sm text-base"
            title={t('document.podcastButton')}
          >
            <IconHeadphones size={16} />
          </button>
        </div>
        {savedResultsBar}
        {docViewerEl}
      </div>

      {/* Separador arrastrable: documento ↔ generar */}
      <div
        onMouseDown={startResize('doc')}
        title="Arrastra para redimensionar"
        className="w-1 shrink-0 cursor-col-resize bg-slate-800 hover:bg-primary-500/60 active:bg-primary-500 transition-colors"
      />

      {podcastModalEl}

      {/* Action Panel */}
      <div data-tour="doc-actions" style={{ width: actionsWidth }} className="overflow-y-auto shrink-0">
        <ActionPanel
          doc={doc}
          onGenerate={generate}
          generating={generating}
          activeAction={activeAction}
        />
      </div>

      {/* Separador arrastrable: generar ↔ resultado */}
      <div
        onMouseDown={startResize('actions')}
        title="Arrastra para redimensionar"
        className="w-1 shrink-0 cursor-col-resize bg-slate-800 hover:bg-primary-500/60 active:bg-primary-500 transition-colors"
      />

      {/* Result Panel — ocupa el resto */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <ResultPanel
          result={result}
          streamedText={streamedText}
          generating={generating}
          genProgress={genProgress}
          doc={doc}
          activeAction={activeAction}
          onSaved={handleSaveResult}
          onPrepDay={handlePrepDay}
        />
      </div>
    </div>
  )
}
