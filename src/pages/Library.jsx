import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore, api, apiUpload, getAuthHeader, getLocalAuthHeader, IS_WEB, IS_MOBILE, IS_ELECTRON } from '../store/appStore'
import * as offlineDocs from '../services/offlineDocs'
import Spinner from '../components/UI/Spinner'
import Modal from '../components/UI/Modal'
import SemanticSearch from '../components/Library/SemanticSearch'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { deleteSyncedSubject, syncSingleDocument, checkCloudPresence } from '../services/syncService'
import WeeklyHoursWidget, { loadWeeklyHours, saveWeeklyHours } from '../components/Study/WeeklyHoursWidget'
import EmailWarningsToggle from '../components/UI/EmailWarningsToggle'
import RetentionChip from '../components/UI/RetentionChip'
import { CURRENT_PLATFORM } from '../lib/retention'
import {
  IconPhoto, IconCamera, IconFileText, IconFolder, IconTrash, IconDeviceFloppy,
  IconCloud, IconBooks, IconDownload, IconMenu2, IconLayoutGrid, IconX, IconHeadphones,
  IconCircleCheck, IconLoader2,
} from '@tabler/icons-react'

// Tooltip que aparece al instante al pasar el ratón (el `title` nativo del
// navegador tarda ~1s y es fácil no llegar a verlo nunca) -- usado para
// explicar el icono de sincronización justo donde y cuando hace falta, en
// vez de solo en el bloque de texto al final de la página.
function FastTooltip({ text, children }) {
  return (
    <span className="relative inline-flex group/tip">
      {children}
      <span className="pointer-events-none absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-[11px] text-slate-200 opacity-0 group-hover/tip:opacity-100 transition-opacity">
        {text}
      </span>
    </span>
  )
}

// ─── Date grouping helpers ──────────────────────────────────────────────────
function getDateGroup(dateStr) {
  const d = new Date(dateStr)
  const today = new Date(); today.setHours(0,0,0,0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const docDay = new Date(d); docDay.setHours(0,0,0,0)
  if (docDay.getTime() === today.getTime())     return 'Hoy'
  if (docDay.getTime() === yesterday.getTime()) return 'Ayer'
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function groupDocsByDate(docs) {
  const sorted = [...docs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const groups = []
  const seen = {}
  for (const doc of sorted) {
    const label = getDateGroup(doc.created_at)
    if (!seen[label]) { seen[label] = true; groups.push({ label, docs: [] }) }
    groups.find(g => g.label === label).docs.push(doc)
  }
  return groups
}

// ─── List row ───────────────────────────────────────────────────────────────
function ListRow({ doc, nameColWidth, selected, onSelect, onNavigate, onDelete, onDragStart, onDragEnd, dragging, isNarrow, onSync, syncing, cloudVerified, onPodcast, onDownload, downloaded, downloading, onDownloadOriginal, downloadingOriginal }) {
  const { t } = useTranslation()

  // ── Móvil: fila compacta apilada (mismo espíritu que MobileLibraryPage) ──
  if (isNarrow) {
    return (
      <div
        onClick={onNavigate}
        className={`group flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer
          hover:bg-slate-800/60 transition-colors select-none
          ${selected ? 'bg-primary-900/30 ring-1 ring-primary-600/50' : ''}`}
      >
        <div className="shrink-0 pt-0.5">
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            onClick={e => e.stopPropagation()}
            aria-label={`Seleccionar ${doc.title}`}
            className="w-4 h-4 rounded accent-primary-500 cursor-pointer"
          />
        </div>
        <span className="shrink-0 text-slate-400">
          {doc.file_type === 'foto' ? <IconPhoto size={18} /> : doc.file_type === 'escaneado' ? <IconCamera size={18} /> : <IconFileText size={18} />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-100 truncate">{doc.title}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <span className="text-[10px] text-slate-500">{doc.pages} pág. · {(doc.file_size / 1024 / 1024).toFixed(1)} MB</span>
            {doc.subject_name && <span className="badge-blue text-[10px] truncate max-w-[80px]">{doc.subject_name}</span>}
            {doc.topic_name   && <span className="text-[10px] bg-slate-700/70 text-slate-300 border border-slate-600 rounded px-1 truncate max-w-[80px]"><IconFolder size={11} className="inline -mt-0.5" /> {doc.topic_name}</span>}
            {doc.original_available && <RetentionChip createdAt={doc.created_at} downloadedAt={doc.downloaded_at} downloadedPlatform={doc.downloaded_platform} />}
          </div>
        </div>
        {onDownload && (
          <button
            onClick={e => { e.stopPropagation(); onDownload(e) }}
            className={`shrink-0 p-1 transition-colors ${downloaded ? 'text-emerald-400' : 'text-amber-400 hover:text-primary-400'}`}
            title={downloaded ? 'En este móvil y en la nube — pulsa para quitar del móvil' : 'Solo en la nube — pulsa para guardar en el móvil'}
          >{downloading ? <IconLoader2 size={16} className="animate-spin" /> : downloaded ? <IconCloud size={16} /> : <IconDownload size={16} />}</button>
        )}
        {onDownloadOriginal && doc.original_available && (
          <button
            onClick={e => { e.stopPropagation(); onDownloadOriginal(doc, e) }}
            className="shrink-0 p-1 text-amber-400 hover:text-primary-400 transition-colors"
            title="Descargar el archivo original antes de que se borre"
          >{downloadingOriginal ? <IconLoader2 size={16} className="animate-spin" /> : <IconDownload size={16} />}</button>
        )}
        <button
          onClick={e => { e.stopPropagation(); onPodcast() }}
          className="shrink-0 p-1 text-slate-600 hover:text-primary-400 transition-colors"
        ><IconHeadphones size={16} /></button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(e) }}
          className="shrink-0 p-1 text-slate-600 hover:text-red-400 transition-colors"
        ><IconTrash size={16} /></button>
      </div>
    )
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onNavigate}
      className={`group flex items-center gap-0 px-4 py-2.5 rounded-lg cursor-pointer
        hover:bg-slate-800/60 transition-colors select-none
        ${selected ? 'bg-primary-900/30 ring-1 ring-primary-600/50' : ''}
        ${dragging ? 'opacity-40' : ''}`}
    >
      {/* Checkbox */}
      <div className="mr-3 shrink-0">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          onClick={e => e.stopPropagation()}
          aria-label={`Seleccionar ${doc.title}`}
          className="w-4 h-4 rounded accent-primary-500 cursor-pointer"
        />
      </div>

      <span className="shrink-0 mr-3 text-slate-400">
        {doc.file_type === 'foto' ? <IconPhoto size={20} /> : doc.file_type === 'escaneado' ? <IconCamera size={20} /> : <IconFileText size={20} />}
      </span>

      {/* Name */}
      <span className="text-sm font-medium text-slate-100 truncate shrink-0 pr-3" style={{ width: nameColWidth }}>
        {doc.title}
      </span>

      <span className="text-xs text-slate-500 w-16 text-right shrink-0">{doc.pages} pág.</span>
      <span className="text-xs text-slate-500 w-16 text-right shrink-0">{(doc.file_size / 1024 / 1024).toFixed(1)} MB</span>

      <div className="flex items-center gap-1 w-56 shrink-0 justify-end px-2">
        {/* Tipo de archivo */}
        {doc.file_type === 'foto'      && <span className="text-[10px] bg-cyan-900/50 text-cyan-300 border border-cyan-700 rounded px-1">{t("library.photo")}</span>}
        {doc.file_type === 'escaneado' && <span className="text-[10px] bg-orange-900/50 text-orange-300 border border-orange-700 rounded px-1">{t("library.scanned")}</span>}
        {doc.file_type === 'pdf'       && <span className="text-[10px] bg-slate-700/70 text-slate-400 border border-slate-600 rounded px-1">PDF</span>}
        {/* Asignatura */}
        {doc.subject_name   && <span className="badge-blue   text-[10px] truncate max-w-[70px]">{doc.subject_name}</span>}
        {/* Tema */}
        {doc.topic_name     && <span className="text-[10px] bg-slate-700/70 text-slate-300 border border-slate-600 rounded px-1 truncate max-w-[70px]"><IconFolder size={11} className="inline -mt-0.5" /> {doc.topic_name}</span>}
        {/* Contenido generado */}
        {doc.has_summary    && <span className="badge-green  text-[10px]">{t("library.summary")}</span>}
        {doc.has_flashcards && <span className="badge-purple text-[10px]">{t("library.flashcards")}</span>}
        {doc.has_plan       && <span className="text-[10px] bg-amber-900/50 text-amber-300 border border-amber-700 rounded px-1">{t("library.plan")}</span>}
      </div>

      <span className="flex-1" />

      {doc.original_available && <RetentionChip createdAt={doc.created_at} downloadedAt={doc.downloaded_at} downloadedPlatform={doc.downloaded_platform} />}

      <span className="text-xs text-slate-500 w-24 text-right shrink-0 ml-2">
        {new Date(doc.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
      </span>

      {onDownloadOriginal && doc.original_available && (
        <button
          onClick={e => { e.stopPropagation(); onDownloadOriginal(doc, e) }}
          className="opacity-0 group-hover:opacity-100 btn-ghost btn-icon btn-sm text-amber-400 shrink-0 ml-1"
          title="Descargar el archivo original antes de que se borre"
        >{downloadingOriginal ? <IconLoader2 size={16} className="animate-spin" /> : <IconDownload size={16} />}</button>
      )}

      {/* Icono sync (solo escritorio) — pulsable para subir/reintentar */}
      {(() => {
        const b = syncBadge(doc, cloudVerified)
        if (!b) return null
        if (b.clickable === false) {
          return <FastTooltip text={b.title}><span className={`${b.color} text-xs shrink-0 ml-1 opacity-60`}>{b.Icon ? <b.Icon size={13} /> : b.icon}</span></FastTooltip>
        }
        return (
          <FastTooltip text={syncing ? 'Subiendo…' : b.title}>
            <button
              onClick={e => { e.stopPropagation(); onSync?.() }}
              disabled={syncing}
              className={`${b.color} text-xs shrink-0 ml-1 hover:opacity-100 ${syncing ? 'opacity-30 cursor-wait' : 'opacity-60'} transition-opacity`}
            >{b.Icon ? <b.Icon size={13} /> : b.icon}</button>
          </FastTooltip>
        )
      })()}

      <button
        onClick={e => { e.stopPropagation(); onPodcast() }}
        className="opacity-0 group-hover:opacity-100 btn-ghost btn-icon btn-sm text-slate-400 hover:text-primary-400 shrink-0 ml-1"
        title="Generar podcast"
      ><IconHeadphones size={16} /></button>

      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 btn-ghost btn-icon btn-sm text-red-400 shrink-0 ml-2"
      ><IconTrash size={16} /></button>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────
// Devuelve icono + color según estado de sync del documento
function syncBadge(doc, cloudVerified) {
  if (IS_ELECTRON) {
    if (doc.supabase_id && cloudVerified.has(doc.supabase_id)) {
      return { Icon: IconCloud, color: 'text-emerald-400', title: 'En este ordenador y en la nube — pulsa para comprobar de nuevo' }
    }
    return { Icon: IconDeviceFloppy, color: 'text-amber-400', title: 'Solo en este ordenador — pulsa para subir a la nube' }
  }
  return null
}

export default function Library() {
  const { t } = useTranslation()
  const { addToast, backendReady } = useAppStore()
  const { user } = useAuth()
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  // ── Aviso de retención: el PDF original se borra a los 10 días de subirlo
  // (el texto y todo lo generado se conserva siempre) — se puede desactivar,
  // pero queda registrado en el servidor con fecha, no solo en el dispositivo.
  const [showRetentionNotice, setShowRetentionNotice] = useState(false)
  useEffect(() => {
    if (!backendReady) return
    api('GET', '/me').then(me => {
      if (!me.pdf_retention_notice_dismissed) setShowRetentionNotice(true)
    }).catch(() => {})
  }, [backendReady])
  async function dismissRetentionNotice() {
    setShowRetentionNotice(false)
    try { await api('POST', '/me/dismiss-pdf-retention-notice') } catch { /* se reintentará en la próxima visita */ }
  }

  // ── Descargas offline (solo MyStudy App móvil) ──
  const [downloadedIds,   setDownloadedIds]   = useState(new Set())
  const [downloadingId,   setDownloadingId]   = useState(null)
  useEffect(() => {
    if (!IS_MOBILE) return
    offlineDocs.listDownloaded().then(list => setDownloadedIds(new Set(list.map(d => d.id)))).catch(() => {})
  }, [])
  async function toggleDownload(doc, e) {
    e?.stopPropagation()
    if (downloadingId) return
    if (downloadedIds.has(doc.id)) {
      await offlineDocs.removeDownload(doc.id)
      setDownloadedIds(prev => { const n = new Set(prev); n.delete(doc.id); return n })
      addToast('Descarga eliminada del móvil', 'success')
    } else {
      setDownloadingId(doc.id)
      try {
        const { hasPdf } = await offlineDocs.downloadDocument(doc.id)
        setDownloadedIds(prev => new Set(prev).add(doc.id))
        addToast('Documento guardado para sin conexión', 'success')
        // Solo si de verdad se guardó el binario original (no todos los
        // documentos lo tienen, ver downloadPdfBinary en offlineDocs.js) --
        // si no, el móvil solo tiene el texto/resultados, no el archivo que
        // se borra a los 10 días, y el aviso debe seguir mostrándose.
        if (hasPdf) {
          const nowIso = new Date().toISOString()
          setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, downloaded_at: nowIso, downloaded_platform: CURRENT_PLATFORM } : d))
          api('POST', `/documents/${doc.id}/mark-downloaded`).catch(() => { /* no crítico */ })
        }
      } catch (err) {
        addToast(`No se pudo descargar: ${err.message}`, 'error')
      } finally {
        setDownloadingId(null)
      }
    }
  }

  // ── Descarga del archivo original (PDF/foto) a este ordenador (web+escritorio) ──
  // En móvil esto ya lo cubre toggleDownload/offlineDocs (guarda el binario
  // dentro de la app para verlo sin conexión) -- aquí es la copia "de verdad"
  // fuera de StudyAI, para que sobreviva al borrado a los 10 días.
  const [downloadingOriginalId, setDownloadingOriginalId] = useState(null)
  async function downloadOriginal(doc, e) {
    e?.stopPropagation()
    if (downloadingOriginalId) return
    setDownloadingOriginalId(doc.id)
    try {
      const { apiBase } = useAppStore.getState()
      const [headers, localHeader] = await Promise.all([getAuthHeader(), getLocalAuthHeader()])
      const res = await fetch(`${apiBase}/documents/${doc.id}/file`, { headers: { ...headers, ...localHeader } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const disposition = res.headers.get('content-disposition') || ''
      const match = disposition.match(/filename="([^"]+)"/)
      const ext = match ? match[1].split('.').pop() : 'pdf'
      const filename = `${doc.title}.${ext}`
      const blob = await res.blob()

      let saved = true
      if (IS_ELECTRON) {
        const buffer = await blob.arrayBuffer()
        const result = await window.electron.dialog.saveBinaryFile({
          suggestedName: filename,
          data: new Uint8Array(buffer),
        })
        saved = result.ok
        if (result.ok) addToast('Archivo guardado', 'success')
        else if (result.reason !== 'cancelled') addToast('No se pudo guardar el archivo', 'error')
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      }

      // Se marca como descargado para que deje de avisar (chip + email) --
      // el borrado real a los 10 días no cambia, solo dejamos de molestar
      // con algo que el usuario ya tiene a salvo.
      if (saved) {
        const nowIso = new Date().toISOString()
        setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, downloaded_at: nowIso, downloaded_platform: CURRENT_PLATFORM } : d))
        api('POST', `/documents/${doc.id}/mark-downloaded`).catch(() => { /* no crítico, se reintentará en la próxima descarga */ })
      }
    } catch (err) {
      addToast(`No se pudo descargar: ${err.message}`, 'error')
    } finally {
      setDownloadingOriginalId(null)
    }
  }

  const [subjects,        setSubjects]        = useState([])
  const [docs,            setDocs]            = useState([])
  const [activeSubject,   setActiveSubject]   = useState(null)
  const [loading,         setLoading]         = useState(true)
  const [uploading,       setUploading]       = useState(false)
  const [showNewSubject,  setShowNewSubject]  = useState(false)
  const [newSubjectName,  setNewSubjectName]  = useState('')
  const [newSubjectColor, setNewSubjectColor] = useState('#3b82f6')
  // ── Temas ──
  const [topics,          setTopics]          = useState([])
  const [showNewTopic,    setShowNewTopic]    = useState(false)
  const [newTopicName,    setNewTopicName]    = useState('')
  const [showAddToTopic,  setShowAddToTopic]  = useState(false)
  const [dragOverTopic,   setDragOverTopic]   = useState(null)
  const [dragOverSubject, setDragOverSubject] = useState(null)
  const [draggingDoc,     setDraggingDoc]     = useState(null)
  const [pageDragOver,    setPageDragOver]    = useState(false)
  const [viewMode,        setViewMode]        = useState(
    () => localStorage.getItem('library_view') || 'grid'
  )
  const [activeView,      setActiveView]      = useState('docs') // 'docs' | 'summaries'
  const [showSubjectsMobile, setShowSubjectsMobile] = useState(false)
  const [summaries,       setSummaries]       = useState([])
  const [loadingSummaries,setLoadingSummaries]= useState(false)
  const [plans,           setPlans]           = useState([])
  const [loadingPlans,    setLoadingPlans]    = useState(false)

  // ── Multi-select ──
  const [selectedDocs,    setSelectedDocs]    = useState(new Set())
  const [showPlanModal,   setShowPlanModal]   = useState(false)
  const [planDate,        setPlanDate]        = useState('')
  const [planTitle,       setPlanTitle]       = useState('')
  const [generatingPlan,  setGeneratingPlan]  = useState(false)
  const [planWeeklyHours, setPlanWeeklyHours] = useState(() => loadWeeklyHours())
  const [planSubjectId,   setPlanSubjectId]   = useState('')
  const [planCustomColor, setPlanCustomColor] = useState(false)
  const [planColor,       setPlanColor]       = useState('#8b5cf6')

  // ── Resumen combinado (varios documentos seleccionados) ──
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [summaryTitle,     setSummaryTitle]     = useState('')
  const [summaryInfo,      setSummaryInfo]      = useState(null)
  const [generatingSummary,setGeneratingSummary]= useState(false)

  function openSummaryModal() {
    setSummaryTitle('')
    setSummaryInfo(null)
    setShowSummaryModal(true)
    api('GET', `/documents/multi-summary/info?doc_ids=${[...selectedDocs].join(',')}`)
      .then(setSummaryInfo)
      .catch(() => {})
  }

  async function generateMultiSummary() {
    if (selectedDocs.size < 2) return
    setGeneratingSummary(true)
    try {
      const res = await api('POST', '/documents/multi-summary', {
        doc_ids: [...selectedDocs],
        title: summaryTitle.trim() || undefined,
      })
      addToast('Resumen combinado generado', 'success')
      setShowSummaryModal(false)
      clearSelection()
      navigate(`/document/${res.doc_id}`, {
        state: { autoResult: res.result, autoAction: 'summary' }
      })
    } catch (e) {
      addToast(`Error: ${e.message}`, 'error')
    } finally {
      setGeneratingSummary(false)
    }
  }

  // ── Flashcards / examen combinados (varios documentos seleccionados) ──
  const [generatingMultiAction, setGeneratingMultiAction] = useState(null) // 'flashcards' | 'test' | null

  async function generateMultiAction(action) {
    if (selectedDocs.size < 2) return
    setGeneratingMultiAction(action)
    try {
      const res = await api('POST', `/documents/multi-generate/${action}`, {
        doc_ids: [...selectedDocs],
      })
      addToast(action === 'flashcards' ? 'Flashcards combinadas generadas' : 'Examen combinado generado', 'success')
      clearSelection()
      navigate(`/document/${res.doc_id}`, {
        state: { autoResult: res.result, autoAction: action }
      })
    } catch (e) {
      addToast(`Error: ${e.message}`, 'error')
    } finally {
      setGeneratingMultiAction(null)
    }
  }

  function toggleSelect(id) {
    setSelectedDocs(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function clearSelection() { setSelectedDocs(new Set()) }

  async function generateMultiPlan() {
    if (selectedDocs.size < 2) return
    setGeneratingPlan(true)
    try {
      const res = await api('POST', '/documents/multi-plan', {
        doc_ids:      [...selectedDocs],
        exam_date:    planDate,
        title:        planTitle.trim() || undefined,
        weekly_hours: planWeeklyHours,
      })
      // Al generar el plan con fecha, se crea también un aviso de examen con
      // esa misma fecha — antes vivían como dos sistemas sin conectar (el plan
      // no aparecía ni en Calendario ni en "Exámenes próximos" de Inicio).
      if (planDate) {
        try {
          await api('POST', '/exams/reminders', {
            title: planTitle.trim() || `Plan conjunto (${selectedDocs.size} asignaturas)`,
            exam_date: planDate,
            subject_id: planSubjectId ? (isNaN(Number(planSubjectId)) ? planSubjectId : Number(planSubjectId)) : null,
            color: planCustomColor ? planColor : null,
          })
        } catch { /* no bloquear la creación del plan si falla el aviso */ }
      }
      addToast(t('library.planModal.generated'), 'success')
      setShowPlanModal(false)
      clearSelection()
      setPlanSubjectId(''); setPlanCustomColor(false); setPlanColor('#8b5cf6')
      navigate(`/document/${res.doc_id}`, {
        state: { autoResult: res.result, autoAction: 'studyplan' }
      })
    } catch (e) {
      addToast(`Error: ${e.message}`, 'error')
    } finally {
      setGeneratingPlan(false)
    }
  }

  // ── Resizable name column ──
  const [nameColWidth, setNameColWidth] = useState(
    () => parseInt(localStorage.getItem('library_name_col_w') || '280', 10)
  )
  const resizingRef   = useRef(false)
  const startXRef     = useRef(0)
  const startWidthRef = useRef(0)
  const liveWidthRef  = useRef(nameColWidth)

  function onResizeStart(e) {
    e.preventDefault()
    resizingRef.current   = true
    startXRef.current     = e.clientX
    startWidthRef.current = nameColWidth

    function onMouseMove(ev) {
      if (!resizingRef.current) return
      const newW = Math.max(140, Math.min(700, startWidthRef.current + ev.clientX - startXRef.current))
      liveWidthRef.current = newW
      setNameColWidth(newW)
    }
    function onMouseUp() {
      resizingRef.current = false
      localStorage.setItem('library_name_col_w', String(liveWidthRef.current))
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup',   onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup',   onMouseUp)
  }

  function setView(mode) {
    setViewMode(mode)
    localStorage.setItem('library_view', mode)
  }

  const fileInputRef    = useRef()
  const uploadTriggered = useRef(false)
  const navigate        = useNavigate()
  const location        = useLocation()

  useEffect(() => { if (!backendReady) return; loadData() }, [backendReady])

  useEffect(() => {
    if (!backendReady || !activeSubject) { setTopics([]); return }
    api('GET', `/subjects/${activeSubject}/topics`)
      .then(r => setTopics(r.items || []))
      .catch(() => setTopics([]))
  }, [activeSubject, backendReady])

  useEffect(() => {
    if (activeView !== 'summaries' || !backendReady) return
    setLoadingSummaries(true)
    api('GET', '/results/summaries')
      .then(r => setSummaries(r.items || []))
      .catch(() => {})
      .finally(() => setLoadingSummaries(false))
  }, [activeView, backendReady])

  function loadPlans() {
    if (!backendReady) return
    setLoadingPlans(true)
    api('GET', '/study-plans')
      .then(r => setPlans(r.items || []))
      .catch(() => {})
      .finally(() => setLoadingPlans(false))
  }

  useEffect(() => {
    if (activeView !== 'plans' || !backendReady) return
    loadPlans()
  }, [activeView, backendReady])

  async function deletePlan(docId, e) {
    e.stopPropagation()
    if (!window.confirm('¿Eliminar este plan de estudio? No se puede deshacer.')) return
    try {
      await api('DELETE', `/documents/${docId}`)
      setPlans(prev => prev.filter(p => p.doc_id !== docId))
      addToast('Plan eliminado', 'success')
    } catch (e) {
      addToast(`Error: ${e.message}`, 'error')
    }
  }

  useEffect(() => {
    if (location.state?.uploadFiles && !uploadTriggered.current) {
      uploadTriggered.current = true
      const files = location.state.uploadFiles
      navigate('/library', { replace: true, state: {} })
      handleFiles(files)
    }
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [subs, allDocs] = await Promise.all([
        api('GET', '/subjects'),
        api('GET', '/documents'),
      ])
      setSubjects(subs.items || [])
      const items = allDocs.items || []
      setDocs(items)
      // Comprobación real contra la nube (no fiarse del flag local) — se hace
      // aparte para no bloquear la carga inicial de la Biblioteca.
      checkCloudPresence(user, items).then(setCloudVerified)
    } catch { addToast(t('library.errorLoading'), 'error') }
    finally   { setLoading(false) }
  }

  async function handleFiles(files, topicId) {
    if (!backendReady) { addToast('El servidor aún está arrancando, espera un momento...', 'warning'); return }
    setUploading(true)
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      if (topicId) fd.append('topic_id', topicId)
      else if (activeSubject) fd.append('subject_id', activeSubject)
      fd.append('content_type', 'printed')  // un PDF subido tal cual es casi siempre texto impreso
      try {
        const doc = await apiUpload('/documents/upload', fd)
        addToast(`"${doc.title}" importado`, 'success')
        navigate(`/document/${doc.id}`)
      } catch (e) {
        addToast(`Error importando ${file.name}: ${e.message}`, 'error')
      }
    }
    setUploading(false)
  }

  // Soltar archivos del sistema operativo sobre la Biblioteca — mismo destino
  // (asignatura activa) que el botón "+ PDF". Distinto del drag interno de
  // tarjetas (draggingDoc), que no trae dataTransfer.files.
  function handlePageDrop(e) {
    e.preventDefault()
    setPageDragOver(false)
    if (draggingDoc) return
    const files = Array.from(e.dataTransfer.files || [])
    const pdfs = files.filter(f => f.type === 'application/pdf')
    if (pdfs.length) handleFiles(pdfs)
    else if (files.length) addToast('Solo se pueden arrastrar PDFs aquí', 'warning')
  }

  async function createSubject() {
    if (!newSubjectName.trim()) return
    if (!backendReady) { addToast('El servidor aún está arrancando, espera un momento...', 'warning'); return }
    try {
      const s = await api('POST', '/subjects', { name: newSubjectName.trim(), color: newSubjectColor })
      setSubjects(prev => [...prev, s])
      setNewSubjectName('')
      setShowNewSubject(false)
      addToast(`Asignatura "${s.name}" creada`, 'success')
    } catch (e) { addToast(e.message, 'error') }
  }

  async function createTopic() {
    if (!newTopicName.trim() || !activeSubject) return
    try {
      const newTopic = await api('POST', `/subjects/${activeSubject}/topics`, { name: newTopicName.trim() })
      setTopics(prev => [...prev, newTopic])
      setNewTopicName('')
      setShowNewTopic(false)
      addToast(t('library.topicCreated', { name: newTopic.name }), 'success')
    } catch (e) { addToast(e.message, 'error') }
  }

  async function addSelectedToTopic(topicId) {
    try {
      await Promise.all([...selectedDocs].map(id => api('PATCH', `/documents/${id}/topic`, { topic_id: topicId })))
      const topic = topics.find(t => t.id === topicId)
      setDocs(prev => prev.map(d => selectedDocs.has(d.id)
        ? { ...d, topic_id: topicId, topic_name: topic?.name, subject_id: topic?.subject_id ?? d.subject_id }
        : d))
      setTopics(prev => prev.map(t => t.id === topicId ? { ...t, doc_count: t.doc_count + selectedDocs.size } : t))
      setShowAddToTopic(false)
      clearSelection()
      addToast(t('library.docAddedToTopic'), 'success')
    } catch (e) { addToast(e.message, 'error') }
  }

  async function deleteSubject(subjectId, subjectName, e) {
    e.stopPropagation()
    if (!confirm(`¿Eliminar la asignatura "${subjectName}"?\nLos documentos no se borran, quedarán sin asignatura.`)) return
    try {
      const subject = subjects.find(s => s.id === subjectId)
      if (subject?.supabase_id) await deleteSyncedSubject(user, subject.supabase_id)
      await api('DELETE', `/subjects/${subjectId}`)
      setSubjects(prev => prev.filter(s => s.id !== subjectId))
      setDocs(prev => prev.map(d => d.subject_id === subjectId ? { ...d, subject_id: null, subject_name: null } : d))
      if (activeSubject === subjectId) setActiveSubject(null)
      addToast(`Asignatura "${subjectName}" eliminada`, 'success')
    } catch (e) { addToast(e.message, 'error') }
  }

  async function assignSubject(docId, subjectId) {
    try {
      await api('PATCH', `/documents/${docId}/subject`, { subject_id: subjectId })
      setDocs(prev => prev.map(d => d.id === docId ? { ...d, subject_id: subjectId } : d))
      addToast(t('library.docMoved'), 'success')
    } catch (e) { addToast(e.message, 'error') }
  }

  async function assignTopic(docId, topicId) {
    try {
      await api('PATCH', `/documents/${docId}/topic`, { topic_id: topicId })
      const topic = topics.find(t => t.id === topicId)
      const prevDoc = docs.find(d => d.id === docId)
      setDocs(prev => prev.map(d => d.id === docId
        ? { ...d, topic_id: topicId, topic_name: topic?.name, subject_id: topic?.subject_id ?? d.subject_id }
        : d))
      setTopics(prev => prev.map(t => {
        if (t.id === topicId) return { ...t, doc_count: t.doc_count + 1 }
        if (t.id === prevDoc?.topic_id) return { ...t, doc_count: Math.max(0, t.doc_count - 1) }
        return t
      }))
      addToast(t('library.docAddedToTopic'), 'success')
    } catch (e) { addToast(e.message, 'error') }
  }

  async function deleteDoc(docId, e) {
    e.stopPropagation()
    const doc = docs.find(d => d.id === docId)
    const msg = IS_ELECTRON && doc?.supabase_id && cloudVerified.has(doc.supabase_id)
      ? '¿Eliminar este documento? Seguirá disponible en la nube (solo se borra de este ordenador).'
      : '¿Eliminar este documento?'
    if (!confirm(msg)) return
    try {
      // Ya no se borra también de la nube — si estaba en ambos sitios, se queda
      // solo en la nube (el usuario decide borrarlo de ahí aparte si quiere).
      await api('DELETE', `/documents/${docId}`)
      setDocs(prev => prev.filter(d => d.id !== docId))
      setSelectedDocs(prev => { const n = new Set(prev); n.delete(docId); return n })
      if (IS_MOBILE) {
        offlineDocs.cleanupAfterCloudDelete(docId)
        setDownloadedIds(prev => { const n = new Set(prev); n.delete(docId); return n })
      }
      addToast(t('library.docDeleted'), 'success')
    } catch (e) { addToast(e.message, 'error') }
  }


  const [syncingDocId, setSyncingDocId] = useState(null)
  const [cloudVerified, setCloudVerified] = useState(new Set())  // supabase_id confirmados de verdad en la nube

  async function handleSyncDoc(doc) {
    if (syncingDocId) return
    setSyncingDocId(doc.id)
    try {
      const result = await syncSingleDocument(user, doc)
      if (result.ok) {
        addToast(result.alreadySynced ? 'Ya estaba sincronizado ✓' : 'Documento subido a la nube ☁️', 'success')
        const refreshed = await api('GET', `/documents/${doc.id}`)
        setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, supabase_id: refreshed.supabase_id, sync_status: refreshed.sync_status } : d))
        if (refreshed.supabase_id) setCloudVerified(prev => new Set(prev).add(refreshed.supabase_id))
      } else {
        addToast('No se pudo subir el documento', 'error')
      }
    } finally {
      setSyncingDocId(null)
    }
  }

  const filteredDocs = activeSubject ? docs.filter(d => d.subject_id === activeSubject) : docs
  const dateGroups   = groupDocsByDate(filteredDocs)
  const selectedNames = [...selectedDocs].map(id => docs.find(d => d.id === id)?.title).filter(Boolean)

  const subjectItems = (
    <>
      <p className="section-title px-2">{t("library.subjects")}</p>
      <button
        onClick={() => { setActiveSubject(null); setActiveView('docs'); setShowSubjectsMobile(false) }}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
          ${activeView === 'docs' && !activeSubject ? 'bg-primary-600/20 text-primary-300' : 'text-slate-400 hover:bg-slate-800'}`}
      >
        <IconBooks size={15} /> {t('library.all')}
        <span className="ml-auto text-xs text-slate-500">{docs.length}</span>
      </button>
      {subjects.map(s => (
        <div
          key={s.id}
          className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer
            ${activeSubject === s.id ? 'bg-primary-600/20 text-primary-300' : 'text-slate-400 hover:bg-slate-800'}
            ${dragOverSubject === s.id ? 'bg-emerald-700/40 border border-emerald-500 text-emerald-300 scale-105' : 'border border-transparent'}`}
          onClick={() => { setActiveSubject(s.id); setActiveView('docs'); setShowSubjectsMobile(false) }}
          onDragOver={e => { e.preventDefault(); setDragOverSubject(s.id) }}
          onDragLeave={() => setDragOverSubject(null)}
          onDrop={e => { e.preventDefault(); setDragOverSubject(null); if (draggingDoc) assignSubject(draggingDoc, s.id) }}
        >
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
          <span className="truncate flex-1">{s.name}</span>
          {docs.filter(d => d.subject_id === s.id).length > 0 && (
            <span className="text-xs text-slate-500 group-hover:hidden">{docs.filter(d => d.subject_id === s.id).length}</span>
          )}
          <button onClick={e => deleteSubject(s.id, s.name, e)}
            className="hidden group-hover:flex items-center justify-center w-4 h-4 text-slate-500 hover:text-red-400 transition-colors text-xs shrink-0"
            title="Eliminar asignatura">✕</button>
        </div>
      ))}
      <div className="border-t border-slate-800 mt-2 pt-2">
        <button
          onClick={() => { setActiveSubject(null); setActiveView('summaries'); setShowSubjectsMobile(false) }}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
            ${activeView === 'summaries' ? 'bg-primary-600/20 text-primary-300' : 'text-slate-400 hover:bg-slate-800'}`}
        >
          <span>📝</span> Resúmenes
          {summaries.length > 0 && <span className="ml-auto text-xs text-slate-500">{summaries.length}</span>}
        </button>
        <button
          onClick={() => { setActiveSubject(null); setActiveView('plans'); setShowSubjectsMobile(false) }}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
            ${activeView === 'plans' ? 'bg-primary-600/20 text-primary-300' : 'text-slate-400 hover:bg-slate-800'}`}
        >
          <span>📅</span> Planes de estudio
          {plans.length > 0 && <span className="ml-auto text-xs text-slate-500">{plans.length}</span>}
        </button>
      </div>
      <button
        onClick={() => backendReady ? setShowNewSubject(true) : addToast('El servidor aún está arrancando...', 'warning')}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors mt-2
          ${backendReady ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-600 cursor-wait'}`}
        title={backendReady ? '' : 'Conectando con el servidor...'}
      >
        {backendReady ? t("library.newSubject") : '⏳ Conectando...'}
      </button>
    </>
  )

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Backdrop móvil ── */}
      {showSubjectsMobile && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setShowSubjectsMobile(false)} />
      )}

      {/* ── Subjects sidebar — desktop: estático, móvil: drawer ── */}
      <div data-tour="library-subjects" className={`
        bg-slate-950 border-r border-slate-800 flex flex-col p-3 gap-1 overflow-y-auto shrink-0
        hidden md:flex
      `}
        style={{ width: '192px' }}
      >
        {subjectItems}
      </div>

      {/* ── Drawer de asignaturas en móvil ── */}
      <div className={`
        fixed top-0 left-16 h-full z-50 w-64
        bg-slate-950 border-r border-slate-800 flex flex-col
        transition-[transform,opacity] duration-200 md:hidden
        ${showSubjectsMobile ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}
      `}>
        <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-slate-800 shrink-0">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Asignaturas</span>
          <button
            onClick={() => setShowSubjectsMobile(false)}
            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-200 text-xl"
          >✕</button>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-1 p-3">
          {subjectItems}
        </div>
      </div>

      {/* ── Main content ── */}
      <div
        className={`flex-1 overflow-auto p-3 md:p-6 relative ${pageDragOver ? 'bg-primary-900/10' : ''}`}
        onDragOver={e => { e.preventDefault(); if (!draggingDoc && Array.from(e.dataTransfer.types).includes('Files')) setPageDragOver(true) }}
        onDragLeave={e => { if (e.currentTarget === e.target) setPageDragOver(false) }}
        onDrop={handlePageDrop}
      >
        {pageDragOver && (
          <div className="absolute inset-2 z-20 rounded-2xl border-2 border-dashed border-primary-500 bg-primary-950/40 flex items-center justify-center pointer-events-none">
            <p className="text-primary-300 font-semibold text-lg">Suelta el PDF para importarlo</p>
          </div>
        )}

        {/* Aviso de retención del PDF original */}
        {showRetentionNotice && (
          <div className="mb-4 rounded-xl border border-amber-700/40 bg-amber-950/30 px-4 py-3 space-y-2">
            <div className="flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5">⏳</span>
              <p className="flex-1 text-xs text-amber-200/90 leading-relaxed">
                El archivo original (PDF/foto) que subes se borra automáticamente a los <b>10 días</b>
                (te avisamos por email 3 días antes) — tus resúmenes, fichas y exámenes
                generados <b>se conservan siempre</b>.
                Si quieres guardar el archivo original, descárgalo a tu ordenador o móvil antes de que pasen esos días.
              </p>
              <button
                onClick={dismissRetentionNotice}
                className="shrink-0 text-amber-300/70 hover:text-amber-200 transition-colors"
                title="No volver a mostrar"
              ><IconX size={16} /></button>
            </div>
            <EmailWarningsToggle className="ml-7" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Botón asignaturas — solo móvil */}
            <button
              onClick={() => setShowSubjectsMobile(true)}
              className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm"
            >
              <IconBooks size={14} />
              <span className="text-xs">{activeSubject ? subjects.find(s => s.id === activeSubject)?.name : 'Asignaturas'}</span>
            </button>
            <h1 className="text-xl font-bold text-slate-100 hidden md:block">
              {activeView === 'summaries'
                ? 'Resúmenes guardados'
                : activeView === 'plans'
                ? 'Planes de estudio'
                : activeSubject ? subjects.find(s => s.id === activeSubject)?.name : t("library.title")}
            </h1>
            <h1 className="text-xl font-bold text-slate-100 md:hidden">
              {activeView === 'summaries' ? 'Resúmenes' : activeView === 'plans' ? 'Planes' : t("library.title")}
            </h1>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex rounded-lg border border-slate-700 overflow-hidden">
              <button
                onClick={() => setView('grid')}
                title={t("library.gridView")}
                className={`px-2.5 py-1.5 text-sm transition-colors
                  ${viewMode === 'grid' ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
              ><IconLayoutGrid size={16} /></button>
              <button
                onClick={() => setView('list')}
                title={t("library.listView")}
                className={`px-2.5 py-1.5 text-sm transition-colors border-l border-slate-700
                  ${viewMode === 'list' ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
              ><IconMenu2 size={16} /></button>
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf" multiple className="hidden"
              onChange={e => handleFiles(Array.from(e.target.files))} />
            <button data-tour="library-upload" onClick={() => fileInputRef.current.click()} className="btn-primary text-sm" disabled={uploading}>
              <span className="hidden sm:inline">{uploading ? t('library.importing') : t('library.importPdf')}</span>
              <span className="sm:hidden">{uploading ? '⏳' : '+ PDF'}</span>
            </button>
          </div>
        </div>

        {/* ── Temas de la asignatura activa ── */}
        {activeView === 'docs' && activeSubject && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {topics.map(topic => (
              <button
                key={topic.id}
                onClick={() => navigate(`/topic/${topic.id}`)}
                onDragOver={e => { e.preventDefault(); setDragOverTopic(topic.id) }}
                onDragLeave={() => setDragOverTopic(null)}
                onDrop={e => { e.preventDefault(); setDragOverTopic(null); if (draggingDoc) assignTopic(draggingDoc, topic.id) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all
                  ${dragOverTopic === topic.id ? 'bg-emerald-700/40 border-emerald-500 text-emerald-300 scale-105' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'}`}
              >
                <IconFolder size={14} /> {topic.name}
                <span className="text-xs text-slate-500">{topic.doc_count}</span>
              </button>
            ))}
            <button
              onClick={() => setShowNewTopic(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800 border border-dashed border-slate-700 transition-colors"
            >
              {t('library.newTopic')}
            </button>
          </div>
        )}

        {/* Search */}
        {activeView === 'docs' && <div className="mb-5"><SemanticSearch /></div>}

        {/* ── Vista Resúmenes ── */}
        {activeView === 'summaries' && (
          <div className="pb-24">
            {loadingSummaries ? (
              <div className="flex justify-center py-20"><Spinner label="Cargando resúmenes..." /></div>
            ) : summaries.length === 0 ? (
              <div className="border-2 border-dashed border-slate-700 rounded-2xl p-16 text-center">
                <div className="text-5xl mb-3">📝</div>
                <p className="text-slate-300 font-medium mb-1">Sin resúmenes guardados</p>
                <p className="text-slate-500 text-sm">Genera un resumen en cualquier documento y pulsa "Guardar"</p>
              </div>
            ) : (
              <div className="space-y-2">
                {summaries.map(s => (
                  <div
                    key={s.id}
                    onClick={() => navigate(`/document/${s.document_id}`, {
                      state: { autoResult: { ...s.data, type: s.type }, autoAction: s.type }
                    })}
                    className="card-hover group flex items-center gap-4 px-4 py-3 cursor-pointer"
                  >
                    <span className="text-2xl shrink-0">📄</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-100 truncate">{s.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{s.document_title}</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/document/${s.document_id}`, { state: { openPodcast: true } }) }}
                      className="opacity-0 group-hover:opacity-100 btn-ghost btn-icon btn-sm text-slate-400 hover:text-primary-400 shrink-0"
                      title="Generar podcast"
                    ><IconHeadphones size={16} /></button>
                    <div className="text-right shrink-0">
                      <span className={`text-[10px] rounded px-1.5 py-0.5 ${s.type === 'extended_summary' ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700' : 'bg-slate-700/70 text-slate-400 border border-slate-600'}`}>
                        {s.type === 'extended_summary' ? 'Ampliado' : 'Resumen'}
                      </span>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(s.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Vista Planes de estudio ── */}
        {activeView === 'plans' && (
          <div className="pb-24">
            {loadingPlans ? (
              <div className="flex justify-center py-20"><Spinner label="Cargando planes..." /></div>
            ) : plans.length === 0 ? (
              <div className="border-2 border-dashed border-slate-700 rounded-2xl p-16 text-center">
                <div className="text-5xl mb-3">📅</div>
                <p className="text-slate-300 font-medium mb-1">Sin planes de estudio guardados</p>
                <p className="text-slate-500 text-sm">Selecciona varios documentos y pulsa "Plan de estudio conjunto" para crear uno</p>
              </div>
            ) : (
              <div className="space-y-2">
                {plans.map(p => {
                  const pct = p.total_topics > 0 ? Math.round((p.done_topics / p.total_topics) * 100) : 0
                  return (
                    <div
                      key={p.doc_id}
                      onClick={async () => {
                        try {
                          const r = await api('GET', `/documents/${p.doc_id}/results`)
                          const item = (r.items || []).find(i => i.type === 'studyplan')
                          navigate(`/document/${p.doc_id}`, {
                            state: { autoResult: item ? item.data : { ...p, days: [] }, autoAction: 'studyplan' }
                          })
                        } catch {
                          navigate(`/document/${p.doc_id}`)
                        }
                      }}
                      className="card-hover group flex items-center gap-4 px-4 py-3 cursor-pointer"
                    >
                      <span className="text-2xl shrink-0">📅</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-100 truncate">{p.title}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 max-w-[160px] h-1.5 rounded-full bg-slate-700 overflow-hidden">
                            <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-500 shrink-0">{p.done_topics}/{p.total_topics} temas</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-3">
                        <div>
                          {p.exam_date && (
                            <p className="text-xs text-slate-400">
                              📆 {new Date(p.exam_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          )}
                          <p className="text-xs text-slate-500 mt-1">{p.days_count} días</p>
                        </div>
                        <button
                          onClick={e => deletePlan(p.doc_id, e)}
                          className="hidden group-hover:flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors shrink-0"
                          title="Eliminar plan"
                        >
                          <IconTrash size={15} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Content — Documentos */}
        {activeView === 'docs' && (loading ? (
          <div className="flex justify-center py-20"><Spinner label={t("library.loading")} /></div>

        ) : filteredDocs.length === 0 ? (
          <div
            className="border-2 border-dashed border-slate-700 rounded-2xl p-16 text-center cursor-pointer hover:border-primary-500 transition-colors"
            onClick={() => fileInputRef.current.click()}
          >
            <div className="flex justify-center mb-3"><IconDownload size={40} className="text-slate-600" /></div>
            <p className="text-slate-300 font-medium mb-1">{t("library.dropPdfs")}</p>
            <p className="text-slate-500 text-sm">{t("library.clickToSelect")}</p>
          </div>

        ) : viewMode === 'grid' ? (
          /* ── GRID ── */
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 pb-24">
            {filteredDocs.map(doc => {
              const sel = selectedDocs.has(doc.id)
              return (
                <div
                  key={doc.id}
                  draggable
                  onDragStart={() => setDraggingDoc(doc.id)}
                  onDragEnd={() => setDraggingDoc(null)}
                  onClick={() => navigate(`/document/${doc.id}`)}
                  className={`card-hover group relative transition-all
                    ${sel ? 'ring-2 ring-primary-500 bg-primary-900/20' : ''}
                    ${draggingDoc === doc.id ? 'opacity-50' : ''}`}
                >
                  {/* Checkbox — top-left, siempre visible en táctil (isNarrow), al pasar el ratón en escritorio */}
                  <div
                    className={`absolute top-3 left-3 z-10 transition-opacity
                      ${sel || isNarrow ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  >
                    <input
                      type="checkbox"
                      checked={sel}
                      onChange={() => toggleSelect(doc.id)}
                      onClick={e => e.stopPropagation()}
                      aria-label={`Seleccionar ${doc.title}`}
                      className="w-4 h-4 rounded accent-primary-500 cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={e => deleteDoc(doc.id, e)}
                    className={`absolute top-3 right-3 btn-ghost btn-icon btn-sm text-red-400 ${isNarrow ? '' : 'opacity-0 group-hover:opacity-100'}`}
                  ><IconTrash size={16} /></button>

                  {/* Podcast + sync abajo a la derecha, uno junto al otro — arriba se
                      solapaba con títulos largos de documento. */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-2">
                    {IS_MOBILE && (
                      <button
                        onClick={e => toggleDownload(doc, e)}
                        className={`transition-opacity ${downloadedIds.has(doc.id) ? 'text-emerald-400' : 'text-amber-400 hover:text-primary-400'} ${isNarrow ? '' : 'opacity-0 group-hover:opacity-100'}`}
                        title={downloadedIds.has(doc.id) ? 'En este móvil y en la nube — pulsa para quitar del móvil' : 'Solo en la nube — pulsa para guardar en el móvil'}
                      >{downloadingId === doc.id ? <IconLoader2 size={14} className="animate-spin" /> : downloadedIds.has(doc.id) ? <IconCloud size={14} /> : <IconDownload size={14} />}</button>
                    )}
                    {!IS_MOBILE && doc.original_available && (
                      <button
                        onClick={e => downloadOriginal(doc, e)}
                        disabled={downloadingOriginalId === doc.id}
                        className={`text-amber-400 hover:text-primary-400 transition-opacity ${isNarrow ? '' : 'opacity-0 group-hover:opacity-100'}`}
                        title="Descargar el archivo original antes de que se borre"
                      >{downloadingOriginalId === doc.id ? <IconLoader2 size={14} className="animate-spin" /> : <IconDownload size={14} />}</button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/document/${doc.id}`, { state: { openPodcast: true } }) }}
                      className={`text-slate-400 hover:text-primary-400 transition-opacity ${isNarrow ? '' : 'opacity-0 group-hover:opacity-100'}`}
                      title="Generar podcast"
                    ><IconHeadphones size={14} /></button>
                    {(() => { const b = syncBadge(doc, cloudVerified); return b ? (
                      <FastTooltip text={syncingDocId === doc.id ? 'Subiendo…' : b.title}>
                        <button
                          onClick={e => { e.stopPropagation(); handleSyncDoc(doc) }}
                          disabled={syncingDocId === doc.id}
                          className={`text-sm ${b.color} ${syncingDocId === doc.id ? 'opacity-30 cursor-wait' : 'opacity-70 hover:opacity-100'} transition-opacity`}
                        >{b.Icon ? <b.Icon size={14} /> : b.icon}</button>
                      </FastTooltip>
                    ) : null })()}
                  </div>

                  <div className="flex items-start gap-3 pl-6">
                    <span className="shrink-0 text-slate-400">
                      {doc.file_type === 'foto' ? <IconPhoto size={26} /> : doc.file_type === 'escaneado' ? <IconCamera size={26} /> : <IconFileText size={26} />}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-100 truncate pr-6">{doc.title}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {doc.pages} páginas · {(doc.file_size / 1024 / 1024).toFixed(1)} MB
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {doc.file_type === 'foto'      && <span className="text-[10px] bg-cyan-900/50 text-cyan-300 border border-cyan-700 rounded px-1">{t("library.photo")}</span>}
                        {doc.file_type === 'escaneado' && <span className="text-[10px] bg-orange-900/50 text-orange-300 border border-orange-700 rounded px-1">{t("library.scanned")}</span>}
                        {doc.file_type === 'pdf'       && <span className="text-[10px] bg-slate-700/70 text-slate-400 border border-slate-600 rounded px-1">PDF</span>}
                        {doc.subject_name   && <span className="badge-blue   text-[10px]">{doc.subject_name}</span>}
                        {doc.topic_name     && <span className="text-[10px] bg-slate-700/70 text-slate-300 border border-slate-600 rounded px-1"><IconFolder size={11} className="inline -mt-0.5" /> {doc.topic_name}</span>}
                        {doc.has_summary    && <span className="badge-green  text-[10px]">{t("library.summary")}</span>}
                        {doc.has_flashcards && <span className="badge-purple text-[10px]">{t("library.flashcards")}</span>}
                        {doc.has_plan       && <span className="text-[10px] bg-amber-900/50 text-amber-300 border border-amber-700 rounded px-1">{t("library.plan")}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pl-6">
                    <p className="text-xs text-slate-500">
                      {new Date(doc.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    {doc.original_available && <RetentionChip createdAt={doc.created_at} downloadedAt={doc.downloaded_at} downloadedPlatform={doc.downloaded_platform} />}
                  </div>
                </div>
              )
            })}
          </div>

        ) : (
          /* ── LIST ── */
          <div className="space-y-5 pb-24">
            {/* Column headers — solo escritorio, en móvil la fila ya lleva todo el detalle */}
            <div className="hidden md:flex items-center gap-0 px-4 pb-1 border-b border-slate-800">
              <span className="w-7 shrink-0" />{/* checkbox placeholder */}
              <span className="text-xl invisible shrink-0 mr-3">📄</span>
              <div className="relative flex items-center shrink-0 pr-3" style={{ width: nameColWidth }}>
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider select-none">{t("library.name")}</span>
                <div
                  onMouseDown={onResizeStart}
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-full flex items-center justify-center cursor-col-resize group/h z-10"
                  title="Arrastrar para redimensionar"
                >
                  <div className="w-px h-4 bg-slate-600 group-hover/h:bg-primary-400 group-hover/h:h-5 transition-all rounded-full" />
                </div>
              </div>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider w-16 text-right shrink-0 select-none">{t("library.pages")}</span>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider w-16 text-right shrink-0 select-none">{t("library.size")}</span>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider w-48 text-right shrink-0 select-none px-2">{t("library.tags")}</span>
              <span className="flex-1" />
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider w-24 text-right shrink-0 select-none">{t('library.date')}</span>
              <span className="w-9 shrink-0" />
            </div>

            {dateGroups.map(group => (
              <div key={group.label}>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest px-4 mb-1">
                  {group.label === 'Hoy' ? t('library.today') : group.label === 'Ayer' ? t('library.yesterday') : group.label}
                </p>
                <div className="space-y-0.5">
                  {group.docs.map(doc => (
                    <ListRow
                      key={doc.id}
                      doc={doc}
                      nameColWidth={nameColWidth}
                      selected={selectedDocs.has(doc.id)}
                      onSelect={() => toggleSelect(doc.id)}
                      dragging={draggingDoc === doc.id}
                      onNavigate={() => navigate(`/document/${doc.id}`)}
                      onDelete={e => deleteDoc(doc.id, e)}
                      onDragStart={() => setDraggingDoc(doc.id)}
                      onDragEnd={() => setDraggingDoc(null)}
                      isNarrow={isNarrow}
                      onSync={() => handleSyncDoc(doc)}
                      syncing={syncingDocId === doc.id}
                      cloudVerified={cloudVerified}
                      onPodcast={() => navigate(`/document/${doc.id}`, { state: { openPodcast: true } })}
                      onDownload={IS_MOBILE ? (e => toggleDownload(doc, e)) : null}
                      downloaded={downloadedIds.has(doc.id)}
                      downloading={downloadingId === doc.id}
                      onDownloadOriginal={!IS_MOBILE ? downloadOriginal : null}
                      downloadingOriginal={downloadingOriginalId === doc.id}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* ── Explicación de sincronización (solo escritorio) ── */}
        {IS_ELECTRON && !loading && filteredDocs.length > 0 && (
          <div className="mt-8 mb-4 p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 text-xs text-slate-400 space-y-1.5">
            <p className="font-medium text-slate-300">☁️ Sobre el icono de sincronización de cada documento</p>
            <p><IconDeviceFloppy size={13} className="inline -mt-0.5 text-amber-400" /> <b className="text-slate-300">Ámbar</b> — solo en este ordenador. Pulsa el icono para subirlo a la nube (se sube el texto, no el PDF).</p>
            <p><IconCloud size={13} className="inline -mt-0.5 text-emerald-400" /> <b className="text-slate-300">Verde</b> — confirmado en este ordenador y en la nube.</p>
            <p>Al eliminar un documento aquí, solo se borra de este ordenador — si ya estaba en la nube, se queda allí. Para borrarlo también de la nube, hazlo desde la web.</p>
            <p>Los PDF que subes se guardan en <code className="bg-slate-900/60 px-1 py-0.5 rounded">%USERPROFILE%\.studyai\uploads</code> — puedes ir ahí para borrar el archivo original a mano si quieres liberar espacio.</p>
          </div>
        )}

        {/* ── Floating multi-select bar ── */}
        {selectedDocs.size >= 1 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
            bg-slate-800/95 backdrop-blur border border-slate-600
            rounded-2xl shadow-2xl px-4 py-3 animate-fade-in
            max-w-[calc(100vw-24px)] overflow-x-auto">
            <div className="flex items-center gap-3 w-max">
              <span className="text-sm text-slate-300 font-medium shrink-0">
                {selectedDocs.size} doc{selectedDocs.size > 1 ? 's' : ''} seleccionado{selectedDocs.size > 1 ? 's' : ''}
              </span>
              {selectedDocs.size >= 2 && (
                <button onClick={openSummaryModal} className="btn-secondary btn-sm shrink-0">
                  📝 Resumen combinado
                </button>
              )}
              {selectedDocs.size >= 2 && (
                <button
                  onClick={() => generateMultiAction('flashcards')}
                  disabled={!!generatingMultiAction}
                  className="btn-secondary btn-sm shrink-0"
                >
                  {generatingMultiAction === 'flashcards' ? '⏳ Generando...' : '🗂️ Flashcards combinadas'}
                </button>
              )}
              {selectedDocs.size >= 2 && (
                <button
                  onClick={() => generateMultiAction('test')}
                  disabled={!!generatingMultiAction}
                  className="btn-secondary btn-sm shrink-0"
                >
                  {generatingMultiAction === 'test' ? '⏳ Generando...' : '✅ Examen combinado'}
                </button>
              )}
              {selectedDocs.size >= 2 && (
                <button
                  onClick={() => { setPlanTitle(''); setPlanDate(''); setShowPlanModal(true) }}
                  className="btn-primary btn-sm shrink-0"
                >
                  {t('library.studyPlanTogether')}
                </button>
              )}
              {activeSubject && (
                <button onClick={() => setShowAddToTopic(true)} className="btn-secondary btn-sm shrink-0">
                  {t('library.addToTopic')}
                </button>
              )}
              <button onClick={clearSelection} className="btn-ghost btn-sm text-slate-400 hover:text-slate-200 shrink-0">
                ✕ Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Multi-summary modal ── */}
      <Modal open={showSummaryModal} onClose={() => !generatingSummary && setShowSummaryModal(false)} title="Resumen combinado" size="sm">
        <div className="space-y-4">
          <div className="bg-slate-900/60 rounded-lg p-3 space-y-1">
            <p className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wider">
              {selectedDocs.size} documentos seleccionados
            </p>
            {selectedNames.map((name, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                <span className="text-slate-500">📄</span> {name}
              </div>
            ))}
          </div>

          {summaryInfo && (
            <p className="text-xs text-slate-500">
              Estrategia: {summaryInfo.strategy === 'multi_pass' ? 'multi-paso (documentos largos)' : 'paso único'}
            </p>
          )}

          <div>
            <label className="text-sm text-slate-400 block mb-1.5">Título <span className="text-slate-600">(opcional)</span></label>
            <input
              className="input w-full"
              placeholder={`Resumen combinado (${selectedDocs.size} documentos)`}
              value={summaryTitle}
              onChange={e => setSummaryTitle(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowSummaryModal(false)} className="btn-secondary flex-1" disabled={generatingSummary}>
              Cancelar
            </button>
            <button onClick={generateMultiSummary} className="btn-primary flex-1" disabled={generatingSummary}>
              {generatingSummary ? '⏳ Generando...' : '📝 Generar resumen'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Multi-plan modal ── */}
      <Modal open={showPlanModal} onClose={() => !generatingPlan && setShowPlanModal(false)} title={t("library.planModal.title")} size="sm">
        <div className="space-y-4">
          {/* Selected docs list */}
          <div className="bg-slate-900/60 rounded-lg p-3 space-y-1">
            <p className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wider">
              {selectedDocs.size} documentos seleccionados
            </p>
            {selectedNames.map((name, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                <span className="text-slate-500">📄</span> {name}
              </div>
            ))}
          </div>

          {/* Exam date */}
          <div>
            <label className="text-sm text-slate-400 block mb-1.5">Fecha del examen</label>
            <input
              type="date"
              className="input w-full"
              value={planDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={e => setPlanDate(e.target.value)}
            />
          </div>

          {/* Optional title */}
          <div>
            <label className="text-sm text-slate-400 block mb-1.5">Título del plan <span className="text-slate-600">(opcional)</span></label>
            <input
              className="input w-full"
              placeholder={`Plan conjunto (${selectedDocs.size} asignaturas)`}
              value={planTitle}
              onChange={e => setPlanTitle(e.target.value)}
            />
          </div>

          {/* Aviso de examen en el calendario — mismo patrón que el formulario de Inicio */}
          {planDate && (
            <div className="bg-slate-900/60 rounded-lg p-3 space-y-2">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">📅 Se creará un aviso de examen con esta fecha</p>
              <div className="flex flex-wrap items-center gap-2">
                <select value={planSubjectId} onChange={e => {
                    setPlanSubjectId(e.target.value)
                    if (!planCustomColor) {
                      const subj = subjects.find(s => String(s.id) === e.target.value)
                      setPlanColor(subj?.color || '#8b5cf6')
                    }
                  }}
                  className="input text-sm py-1.5 flex-1 min-w-32">
                  <option value=''>Sin asignatura</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-slate-400">
                  <input type="checkbox" checked={planCustomColor}
                    onChange={e => {
                      setPlanCustomColor(e.target.checked)
                      if (!e.target.checked) {
                        const subj = subjects.find(s => String(s.id) === planSubjectId)
                        setPlanColor(subj?.color || '#8b5cf6')
                      }
                    }}
                    className="w-3.5 h-3.5" />
                  Color propio
                </label>
                {planCustomColor && (
                  <input type="color" value={planColor} onChange={e => setPlanColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" title="Color" />
                )}
              </div>
            </div>
          )}

          {/* Horas disponibles por día */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Horas disponibles / semana</p>
            <WeeklyHoursWidget
              compact
              hours={planWeeklyHours}
              onChange={h => { setPlanWeeklyHours(h); saveWeeklyHours(h) }}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setShowPlanModal(false)}
              className="btn-secondary flex-1"
              disabled={generatingPlan}
            >
              Cancelar
            </button>
            <button
              onClick={generateMultiPlan}
              className="btn-primary flex-1"
              disabled={generatingPlan || !planDate}
            >
              {generatingPlan ? '⏳ Generando...' : '📅 Generar plan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── New topic modal ── */}
      <Modal open={showNewTopic} onClose={() => setShowNewTopic(false)} title={t('library.newTopicModal.title')} size="sm">
        <div className="space-y-4">
          <input
            className="input"
            placeholder={t('library.newTopicModal.namePlaceholder')}
            value={newTopicName}
            onChange={e => setNewTopicName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createTopic()}
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={() => setShowNewTopic(false)} className="btn-secondary flex-1">{t('library.newTopicModal.cancel')}</button>
            <button onClick={createTopic} className="btn-primary flex-1">{t('library.newTopicModal.create')}</button>
          </div>
        </div>
      </Modal>

      {/* ── Add-to-topic picker ── */}
      <Modal open={showAddToTopic} onClose={() => setShowAddToTopic(false)} title={t('library.addToTopicModal.title')} size="sm">
        <div className="space-y-2">
          {topics.length === 0 && (
            <p className="text-sm text-slate-500">{t('library.noTopicsYet')}</p>
          )}
          {topics.map(topic => (
            <button
              key={topic.id}
              onClick={() => addSelectedToTopic(topic.id)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              <IconFolder size={14} /> {topic.name}
              <span className="ml-auto text-xs text-slate-500">{topic.doc_count}</span>
            </button>
          ))}
          <button
            onClick={() => { setShowAddToTopic(false); setShowNewTopic(true) }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left text-slate-500 hover:text-slate-300 border border-dashed border-slate-700"
          >
            {t('library.addToTopicModal.createNew')}
          </button>
        </div>
      </Modal>

      {/* ── New subject modal ── */}
      <Modal open={showNewSubject} onClose={() => setShowNewSubject(false)} title={t("library.newSubjectModal.title")} size="sm">
        <div className="space-y-4">
          <input
            className="input"
            placeholder={t("library.newSubjectModal.namePlaceholder")}
            value={newSubjectName}
            onChange={e => setNewSubjectName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createSubject()}
            autoFocus
          />
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-400">Color:</label>
            <input type="color" value={newSubjectColor} onChange={e => setNewSubjectColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer bg-transparent border-0" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowNewSubject(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={createSubject} className="btn-primary flex-1">Crear</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
