import { useState } from 'react'
import { Filesystem } from '@capacitor/filesystem'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { api, apiUpload, useAppStore } from '../store/appStore'
import { useDocumentScan } from './useDocumentScan'
import { ensureMathDelimiters } from '../utils/mathText'
import {
  IconArrowLeft, IconCalculator, IconPackage, IconCamera, IconSparkles,
  IconLoader2, IconRefresh, IconChevronUp, IconChevronDown, IconDeviceFloppy,
} from '@tabler/icons-react'

const MD_OPTS = { remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex] }

export default function MobileExerciseSolverPage() {
  const [previewB64, setPreviewB64] = useState(null)
  const [photoUri, setPhotoUri]     = useState(null)
  const [solving, setSolving]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [result, setResult]         = useState(null)
  const [expandedStep, setExpandedStep] = useState(true)
  // Ver arriba (ExerciseSolverPage): hay símbolos ambiguos en el papel que
  // ningún motor acierta — dejar corregir la lectura evita que el alumno se
  // quede con un resultado equivocado con pinta de bueno.
  const [editingStatement, setEditingStatement] = useState(null)
  const [resolvingText, setResolvingText] = useState(false)
  const { scan: docScan, installing, installProgress } = useDocumentScan()
  const { addToast } = useAppStore()
  const navigate = useNavigate()

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
    } catch (e) {
      if (!e.quotaExceeded) addToast('No se pudo resolver el ejercicio: ' + e.message, 'error')
    } finally {
      setSolving(false)
    }
  }

  const guardar = async () => {
    if (!result) return
    setSaving(true)
    try {
      const lines = [
        result.statement,
        '',
        ...(result.steps || []).map((s, i) => `${i + 1}. ${s}`),
        '',
        `Resultado: ${result.answer}`,
      ]
      const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
      const title = (result.topic || 'Ejercicio').slice(0, 60)
      const form = new FormData()
      form.append('file', new File([blob], `${title}.txt`, { type: 'text/plain' }))
      form.append('label', 'Ejercicio')
      await apiUpload('/documents/upload-text', form)
      addToast('¡Ejercicio guardado en tu biblioteca!', 'success')
      navigate('/')
    } catch (e) {
      addToast('No se pudo guardar: ' + e.message, 'error')
    } finally {
      setSaving(false)
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

        {!installing && !previewB64 && (
          <>
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full h-52 rounded-2xl border-2 border-dashed border-slate-600
                              flex flex-col items-center justify-center gap-3 text-slate-500">
                <IconCalculator size={44} />
                <span className="text-sm text-center px-4">
                  Escanea un ejercicio y te lo resolvemos paso a paso
                </span>
              </div>
            </div>
            <button
              onClick={hacerFoto}
              className="w-full py-6 rounded-2xl bg-primary-600 text-white font-bold text-xl
                         active:bg-primary-700 transition-colors flex items-center justify-center gap-3 shadow-lg"
            >
              <IconCamera size={28} /> Escanear ejercicio
            </button>
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

            <button
              onClick={guardar}
              disabled={saving}
              className="w-full py-5 rounded-2xl bg-primary-600 text-white font-bold text-lg
                         active:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {saving
                ? <span className="flex items-center justify-center gap-2"><IconLoader2 size={16} className="animate-spin" /> Guardando...</span>
                : <span className="flex items-center justify-center gap-2"><IconDeviceFloppy size={16} /> Guardar en biblioteca</span>}
            </button>
            <button
              onClick={otro}
              disabled={saving}
              className="w-full py-4 rounded-2xl bg-slate-700 text-slate-300 font-medium
                         active:bg-slate-600 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              <IconRefresh size={16} /> Resolver otro
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
