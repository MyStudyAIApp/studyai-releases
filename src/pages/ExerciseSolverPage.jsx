import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, api, apiUpload } from '../store/appStore'
import ProblemsView from '../components/Exam/ProblemsView'
import Spinner from '../components/UI/Spinner'

export default function ExerciseSolverPage() {
  const { addToast } = useAppStore()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [previewUrl, setPreviewUrl] = useState(null)
  const [file, setFile] = useState(null)
  const [solving, setSolving] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const [recent, setRecent] = useState([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  useEffect(() => {
    loadRecent()
  }, [])

  function loadRecent() {
    setLoadingRecent(true)
    api('GET', '/documents').then(docs => {
      const items = (docs.items || [])
        .filter(d => d.title.startsWith('[Ejercicio]'))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10)
      setRecent(items)
    }).catch(() => {})
    .finally(() => setLoadingRecent(false))
  }

  function handleFile(f) {
    if (!f) return
    setFile(f)
    setResult(null)
    setPreviewUrl(URL.createObjectURL(f))
  }

  function openPicker() {
    fileInputRef.current?.click()
  }

  function handleDrop(e) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  async function resolver() {
    if (!file) return
    setSolving(true)
    setResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('difficulty', 'normal')
      const data = await apiUpload('/exercises/solve-photo', form)
      setResult(data)
    } catch (e) {
      if (!e.quotaExceeded) addToast('No se pudo resolver el ejercicio: ' + e.message, 'error')
    } finally {
      setSolving(false)
    }
  }

  async function guardar() {
    if (!result) return
    setSaving(true)
    try {
      const lines = [
        result.statement,
        '',
        ...result.steps.map((s, i) => `${i + 1}. ${s}`),
        '',
        `Resultado: ${result.answer}`,
      ]
      const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
      const title = (result.topic || 'Ejercicio').slice(0, 60)
      const fileToSave = new File([blob], `${title}.txt`, { type: 'text/plain' })
      const form = new FormData()
      form.append('file', fileToSave)
      form.append('label', 'Ejercicio')
      await apiUpload('/documents/upload-text', form)
      addToast('Ejercicio guardado en la biblioteca', 'success')
      loadRecent()
    } catch (e) {
      addToast('No se pudo guardar: ' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  function otro() {
    setFile(null)
    setResult(null)
    setPreviewUrl(null)
  }

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden overflow-y-auto md:overflow-y-hidden">

      {/* ── Left: capture + result ── */}
      <div data-tour="solve-panel" className="w-full md:w-[480px] shrink-0 border-b md:border-b-0 md:border-r border-slate-800 md:overflow-y-auto p-5 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            🧮 Resolver ejercicio
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Sube una foto, un PDF, o haz una foto de un ejercicio y te lo resolvemos paso a paso.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0])}
        />

        {!previewUrl && (
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={openPicker}
            className="border-2 border-dashed border-slate-600 hover:border-primary-500 rounded-2xl p-8
                       text-center transition-all duration-200 cursor-pointer"
          >
            <div className="text-5xl mb-3">📸</div>
            <p className="text-slate-300 font-medium mb-1">Arrastra una foto o PDF, o haz clic para elegir</p>
            <p className="text-slate-500 text-xs">Foto, galería o PDF — en el móvil te deja elegir la cámara también</p>
          </div>
        )}

        {previewUrl && !result && (
          <div className="space-y-3">
            <div className="rounded-2xl overflow-hidden border border-slate-700">
              {file?.type === 'application/pdf' ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 bg-slate-800/50">
                  <span className="text-5xl">📄</span>
                  <p className="text-slate-300 text-sm px-4 text-center break-all">{file.name}</p>
                  <p className="text-slate-500 text-xs">Se resolverá la primera página</p>
                </div>
              ) : (
                <img src={previewUrl} alt="Ejercicio a resolver" className="w-full object-contain max-h-72" />
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={otro} disabled={solving} className="btn-secondary flex-1 btn-sm">
                Cambiar foto
              </button>
              <button onClick={resolver} disabled={solving} className="btn-primary flex-1 btn-sm">
                {solving ? '⏳ Resolviendo...' : '✨ Resolver'}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button onClick={otro} className="btn-secondary flex-1 btn-sm">
                Resolver otro
              </button>
              <button onClick={guardar} disabled={saving} className="btn-primary flex-1 btn-sm">
                {saving ? '⏳ Guardando...' : '💾 Guardar'}
              </button>
            </div>
          </div>
        )}

        <div className="card bg-slate-900/40 border-slate-700/50 space-y-2 text-xs text-slate-500">
          <p className="font-medium text-slate-400">Cómo funciona:</p>
          <p>📖 Lee el enunciado directamente de la foto o el PDF</p>
          <p>✅ Resuelve paso a paso, sin saltarse ninguno</p>
          <p>📐 Funciona mejor con matemáticas, física y química</p>
        </div>
      </div>

      {/* ── Right: result / recent ── */}
      <div className="flex-1 md:overflow-y-auto p-5">
        {solving && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center text-slate-500">
            <Spinner />
            <p className="font-medium text-slate-400">Leyendo y resolviendo el ejercicio...</p>
          </div>
        )}

        {!solving && result && (
          <ProblemsView result={{ problems: [result] }} />
        )}

        {!solving && !result && (
          <>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Ejercicios resueltos recientes
            </h2>
            {loadingRecent ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-slate-500">
                <span className="text-5xl mb-4">🧮</span>
                <p className="font-medium text-slate-400">Aún no has resuelto ningún ejercicio</p>
                <p className="text-sm mt-1">Sube una foto para empezar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recent.map(doc => (
                  <div
                    key={doc.id}
                    onClick={() => navigate(`/document/${doc.id}`)}
                    className="card-hover flex items-start gap-3 cursor-pointer group"
                  >
                    <span className="text-2xl shrink-0 mt-0.5">🧮</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-100 truncate">
                        {doc.title.replace('[Ejercicio] ', '')}
                      </p>
                      <span className="text-xs text-slate-500">
                        {new Date(doc.created_at).toLocaleDateString('es-ES', {
                          weekday: 'short', day: 'numeric', month: 'short'
                        })}
                      </span>
                    </div>
                    <span className="text-slate-600 group-hover:text-slate-300 transition-colors text-sm">→</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
