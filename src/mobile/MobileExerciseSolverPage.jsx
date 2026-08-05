import { useState, useEffect } from 'react'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Preferences } from '@capacitor/preferences'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { api, apiUpload, useAppStore } from '../store/appStore'
import { useDocumentScan } from './useDocumentScan'
import { ensureMathDelimiters } from '../utils/mathText'
import EmailWarningsToggle from '../components/UI/EmailWarningsToggle'
import {
  IconArrowLeft, IconCalculator, IconPackage, IconCamera, IconSparkles,
  IconLoader2, IconRefresh, IconChevronUp, IconChevronDown, IconTrash,
  IconDownload, IconCircleCheck, IconX,
} from '@tabler/icons-react'

const MD_OPTS = { remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex] }
const RETENTION_DAYS = 10

// Guardado local del móvil (independiente de los 10 días en la nube) — mismo
// patrón que los podcasts descargados (MobilePodcastsPage.jsx): un índice
// ligero en Preferences + el texto en un archivo en Directory.Data.
const DOWNLOAD_INDEX_KEY = 'downloaded_exercises'

async function readDownloadIndex() {
  const { value } = await Preferences.get({ key: DOWNLOAD_INDEX_KEY })
  return value ? JSON.parse(value) : []
}

function diasParaCaducar(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

export default function MobileExerciseSolverPage() {
  const [previewB64, setPreviewB64] = useState(null)
  const [photoUri, setPhotoUri]     = useState(null)
  const [solving, setSolving]       = useState(false)
  const [result, setResult]         = useState(null)
  const [expandedStep, setExpandedStep] = useState(true)
  // Ver ExerciseSolverPage (escritorio/web): hay símbolos ambiguos en el papel
  // que ningún motor acierta — dejar corregir la lectura evita que el alumno
  // se quede con un resultado equivocado con pinta de bueno.
  const [editingStatement, setEditingStatement] = useState(null)
  const [resolvingText, setResolvingText] = useState(false)
  const { scan: docScan, installing, installProgress } = useDocumentScan()
  const { addToast } = useAppStore()
  const navigate = useNavigate()

  // ── Ejercicios de los últimos 10 días (se autoguardan, no viven en la Biblioteca) ──
  const [recent, setRecent] = useState([])
  const [loadingRecent, setLoadingRecent] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [downloadedIds, setDownloadedIds] = useState(new Set())
  const [busyDownloadId, setBusyDownloadId] = useState(null)
  const [showRetentionNotice, setShowRetentionNotice] = useState(false)

  useEffect(() => {
    loadRecent()
    readDownloadIndex().then(list => setDownloadedIds(new Set(list.map(d => d.id))))
    api('GET', '/me').then(me => {
      if (!me.exercise_retention_notice_dismissed) setShowRetentionNotice(true)
    }).catch(() => {})
  }, [])

  function loadRecent() {
    setLoadingRecent(true)
    api('GET', '/exercises/recent').then(r => setRecent(r.items || []))
      .catch(() => {})
      .finally(() => setLoadingRecent(false))
  }

  async function dismissRetentionNotice() {
    setShowRetentionNotice(false)
    try { await api('POST', '/me/dismiss-exercise-retention-notice') } catch { /* se reintentará luego */ }
  }

  async function borrarGuardado(docId) {
    try {
      await api('DELETE', `/documents/${docId}`)
      setRecent(prev => prev.filter(d => d.id !== docId))
      addToast('Ejercicio eliminado', 'success')
    } catch (e) {
      addToast('No se pudo eliminar: ' + e.message, 'error')
    }
  }

  // Descarga al propio móvil (independiente de los 10 días en la nube) —
  // se queda en el dispositivo aunque el original ya haya caducado.
  async function descargarAlMovil(doc) {
    setBusyDownloadId(doc.id)
    try {
      const path = `exercise_${doc.id}.txt`
      await Filesystem.writeFile({ path, data: doc.text_content, directory: Directory.Data, encoding: Encoding.UTF8 })
      const list = await readDownloadIndex()
      const entry = { id: doc.id, title: doc.title, path, downloadedAt: Date.now() }
      await Preferences.set({ key: DOWNLOAD_INDEX_KEY, value: JSON.stringify([entry, ...list.filter(d => d.id !== doc.id)]) })
      setDownloadedIds(prev => new Set(prev).add(doc.id))
      addToast('Guardado en el móvil', 'success')
    } catch (e) {
      addToast('No se pudo descargar: ' + e.message, 'error')
    } finally {
      setBusyDownloadId(null)
    }
  }

  const hacerFoto = async () => {
    try {
      // Escáner de documentos en vez de foto de cámara normal: detecta el
      // borde de la hoja, corrige la perspectiva y mejora el contraste —
      // le llega un ejercicio mucho más legible a la IA.
      const result = await docScan({
        pageLimit: 1,
        galleryImportAllowed: true,
        resultFormats: 'JPEG',
        scannerMode: 'FULL',
      })
      if (!result) return
      const uri = result.scannedImages[0]
      const { data } = await Filesystem.readFile({ path: uri })
      setPreviewB64(data)
      setPhotoUri(uri)
      setResult(null)
    } catch (err) {
      if (!err.message?.toLowerCase().includes('cancel')) {
        addToast('No se pudo abrir el escáner', 'error')
      }
    }
  }

  const resolver = async () => {
    if (!photoUri) return
    setSolving(true)
    try {
      const { data } = await Filesystem.readFile({ path: photoUri })
      const binary = atob(data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'image/jpeg' })

      const form = new FormData()
      form.append('file', new File([blob], 'ejercicio.jpg', { type: 'image/jpeg' }))
      form.append('difficulty', 'normal')
      const data2 = await apiUpload('/exercises/solve-photo', form)
      setResult(data2)
      loadRecent()  // se autoguarda en el servidor; refrescar la lista de aquí
    } catch (e) {
      if (!e.quotaExceeded) addToast('No se pudo resolver el ejercicio: ' + e.message, 'error')
    } finally {
      setSolving(false)
    }
  }

  const resolverConTexto = async () => {
    const statement = (editingStatement || '').trim()
    if (!statement) { addToast('Escribe el enunciado', 'warning'); return }
    setResolvingText(true)
    try {
      const data = await api('POST', '/exercises/solve-text', { statement, difficulty: 'normal' })
      setResult(data)
      setEditingStatement(null)
      loadRecent()
    } catch (e) {
      if (!e.quotaExceeded) addToast('No se pudo resolver: ' + e.message, 'error')
    } finally {
      setResolvingText(false)
    }
  }

  const otro = () => {
    setPreviewB64(null)
    setPhotoUri(null)
    setResult(null)
    setEditingStatement(null)
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-12 pb-5">
        <button onClick={() => navigate('/')} className="text-slate-400 p-1"><IconArrowLeft size={22} /></button>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2"><IconCalculator size={20} /> Resolver ejercicio</h1>
      </div>

      <div className="flex-1 flex flex-col px-5 gap-5 pb-8">

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

        {!installing && !previewB64 && !result && (
          <>
            <div className="rounded-2xl border-2 border-dashed border-slate-600
                            flex flex-col items-center justify-center gap-2 py-8 text-slate-500">
              <IconCalculator size={40} />
              <span className="text-sm text-center px-4">
                Escanea un ejercicio y te lo resolvemos paso a paso
              </span>
            </div>
            <button
              onClick={hacerFoto}
              className="w-full py-5 rounded-2xl bg-primary-600 text-white font-bold text-lg
                         active:bg-primary-700 transition-colors flex items-center justify-center gap-3 shadow-lg"
            >
              <IconCamera size={24} /> Escanear ejercicio
            </button>

            {/* Ejercicios de los últimos 10 días */}
            <div className="flex-1 overflow-y-auto -mx-5 px-5">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 mt-2">
                Tus ejercicios de los últimos {RETENTION_DAYS} días
              </h2>

              {showRetentionNotice && (
                <div className="mb-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-base leading-none mt-0.5">⏳</span>
                    <p className="flex-1 text-[11px] text-amber-200/90 leading-relaxed">
                      Se guardan solos y se borran solos a los {RETENTION_DAYS} días
                      (avisamos por email 3 días antes). Descarga los que quieras conservar con el botón ⬇️.
                    </p>
                    <button onClick={dismissRetentionNotice} className="shrink-0 text-amber-300/70 active:text-amber-200">
                      <IconX size={16} />
                    </button>
                  </div>
                  <EmailWarningsToggle className="ml-6" />
                </div>
              )}

              {loadingRecent ? (
                <div className="flex justify-center py-8"><IconLoader2 size={24} className="animate-spin text-slate-500" /></div>
              ) : recent.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">Aún no has resuelto ningún ejercicio</p>
              ) : (
                <div className="space-y-2 pb-4">
                  {recent.map(doc => {
                    const dias = diasParaCaducar(doc.expires_at)
                    const expanded = expandedId === doc.id
                    const downloaded = downloadedIds.has(doc.id)
                    return (
                      <div key={doc.id} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                        <button
                          onClick={() => setExpandedId(expanded ? null : doc.id)}
                          className="w-full flex items-start gap-2 p-3 text-left"
                        >
                          <span className="text-xl shrink-0">🧮</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-100 truncate">{doc.title}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${dias <= 2 ? 'bg-red-500/15 text-red-300' : 'bg-slate-700/60 text-slate-400'}`}>
                              {dias === 0 ? 'caduca hoy' : `caduca en ${dias} día${dias === 1 ? '' : 's'}`}
                            </span>
                          </div>
                          {expanded ? <IconChevronUp size={16} className="text-slate-500 shrink-0 mt-1" /> : <IconChevronDown size={16} className="text-slate-500 shrink-0 mt-1" />}
                        </button>
                        {expanded && (
                          <div className="px-3 pb-3 space-y-3">
                            <div className="prose-studyai text-sm text-slate-300 border-t border-slate-700 pt-3">
                              <ReactMarkdown {...MD_OPTS}>
                                {ensureMathDelimiters(doc.text_content).replace(/\n/g, '\n\n')}
                              </ReactMarkdown>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => descargarAlMovil(doc)}
                                disabled={busyDownloadId === doc.id}
                                className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5
                                  ${downloaded ? 'bg-emerald-900/30 text-emerald-300' : 'bg-slate-700 text-slate-200 active:bg-slate-600'}`}
                              >
                                {busyDownloadId === doc.id
                                  ? <IconLoader2 size={14} className="animate-spin" />
                                  : downloaded ? <IconCircleCheck size={14} /> : <IconDownload size={14} />}
                                {downloaded ? 'Guardado en el móvil' : 'Descargar al móvil'}
                              </button>
                              <button
                                onClick={() => borrarGuardado(doc.id)}
                                className="px-3 rounded-xl bg-slate-700 text-red-400 active:bg-slate-600"
                              ><IconTrash size={16} /></button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {previewB64 && !result && (
          <>
            <div className="rounded-2xl overflow-hidden border border-slate-700 shadow-lg bg-slate-800">
              <img
                src={`data:image/jpeg;base64,${previewB64}`}
                alt="Ejercicio a resolver"
                className="w-full object-contain max-h-[50vh]"
              />
            </div>
            <button
              onClick={resolver}
              disabled={solving}
              className="w-full py-5 rounded-2xl bg-primary-600 text-white font-bold text-lg
                         active:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {solving
                ? <span className="flex items-center justify-center gap-2"><IconLoader2 size={16} className="animate-spin" /> Resolviendo...</span>
                : <span className="flex items-center justify-center gap-2"><IconSparkles size={16} /> Resolver</span>}
            </button>
            <button
              onClick={otro}
              disabled={solving}
              className="w-full py-4 rounded-2xl bg-slate-700 text-slate-300 font-medium
                         active:bg-slate-600 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              <IconRefresh size={16} /> Cambiar foto
            </button>
          </>
        )}

        {result && (
          <div className="flex-1 overflow-y-auto space-y-4">
            <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
              {result.topic && (
                <span className="inline-block bg-primary-900/40 text-primary-300 text-xs font-semibold px-2.5 py-1 rounded-full mb-2">
                  {result.topic}
                </span>
              )}
              <div className="prose-studyai text-sm text-slate-100">
                <ReactMarkdown {...MD_OPTS}>{ensureMathDelimiters(result.statement)}</ReactMarkdown>
              </div>
            </div>

            {/* Comprobar la lectura antes de fiarse del resultado */}
            {editingStatement === null ? (
              <button
                onClick={() => setEditingStatement(result.statement || '')}
                className="w-full rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-left"
              >
                <span className="block text-xs font-medium text-amber-300/90">
                  ✏️ ¿He leído bien tu ejercicio?
                </span>
                <span className="block text-[11px] text-slate-400 mt-0.5">
                  Si algún número o signo no coincide, tócame para corregirlo
                </span>
              </button>
            ) : (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 space-y-3">
                <p className="text-xs font-medium text-amber-300/90">
                  Corrige el enunciado y lo resuelvo de nuevo
                </p>
                <textarea
                  value={editingStatement}
                  onChange={e => setEditingStatement(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2
                             text-sm text-slate-100 font-mono outline-none focus:border-primary-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingStatement(null)}
                    disabled={resolvingText}
                    className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-medium
                               active:bg-slate-600 disabled:opacity-40 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={resolverConTexto}
                    disabled={resolvingText}
                    className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-bold
                               active:bg-primary-700 disabled:opacity-50 text-sm"
                  >
                    {resolvingText ? 'Resolviendo...' : 'Resolver con esto'}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setExpandedStep(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 rounded-2xl border border-slate-700"
            >
              <span className="font-semibold text-slate-200 text-sm flex items-center gap-1.5">
                {expandedStep ? <><IconChevronUp size={15} /> Ocultar solución</> : <><IconChevronDown size={15} /> Ver solución paso a paso</>}
              </span>
            </button>

            {expandedStep && (
              <div className="space-y-3">
                {(result.steps || []).map((step, i) => (
                  <div key={i} className="flex gap-3 items-start bg-slate-800/60 rounded-xl p-3">
                    <span className="w-6 h-6 rounded-full bg-primary-800 text-primary-200 text-xs
                                     flex items-center justify-center font-bold shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 prose-studyai text-sm text-slate-300">
                      <ReactMarkdown {...MD_OPTS}>{step}</ReactMarkdown>
                    </div>
                  </div>
                ))}

                {result.answer && (
                  <div className="bg-emerald-900/30 border border-emerald-700 rounded-2xl px-4 py-3">
                    <p className="text-xs text-emerald-400 font-semibold uppercase mb-1">Resultado</p>
                    <div className="prose-studyai text-sm font-semibold text-slate-100">
                      <ReactMarkdown {...MD_OPTS}>{result.answer}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Ya se ha guardado solo (10 días) — aquí solo queda seguir */}
            <button
              onClick={otro}
              className="w-full py-4 rounded-2xl bg-slate-700 text-slate-300 font-medium
                         active:bg-slate-600 transition-colors flex items-center justify-center gap-2"
            >
              <IconRefresh size={16} /> Resolver otro
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
