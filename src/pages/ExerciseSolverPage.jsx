import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, api, apiUpload } from '../store/appStore'
import ProblemsView from '../components/Exam/ProblemsView'
import Spinner from '../components/UI/Spinner'
import { IconTrash } from '@tabler/icons-react'

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
  // Corrección del enunciado: hay símbolos que en el papel son genuinamente
  // ambiguos (un "1" cuyo remate parece un menos) y ningún motor los acierta —
  // dejar corregir la lectura es el único remedio real, y evita que el alumno
  // se quede con un resultado equivocado que parece bueno.
  const [editingStatement, setEditingStatement] = useState(null)
  const [resolvingText, setResolvingText] = useState(false)

  useEffect(() => {
    loadRecent()
  }, [])

  function loadRecent() {
    setLoadingRecent(true)
    api('GET', '/documents').then(docs => {
      const items = (docs.items || [])
        .filter(d => d.title?.startsWith('[Ejercicio]'))
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
    setEditingStatement(null)
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
    setEditingStatement(null)
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

  async function resolverConTexto() {
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

  async function borrar(docId, e) {
    e.stopPropagation()
    if (!window.confirm('¿Eliminar este ejercicio? No se puede deshacer.')) return
    try {
      await api('DELETE', `/documents/${docId}`)
      setRecent(prev => prev.filter(d => d.id !== docId))
      addToast('Ejercicio eliminado', 'success')
    } catch (e) {
      addToast('No se pudo eliminar: ' + e.message, 'error')
    }
  }

  function otro() {
    setFile(null)
    setResult(null)
    setEditingStatement(null)
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
          <>
            {/* Comprobación de la lectura — antes del resultado a propósito:
                si la IA leyó mal un símbolo, todo lo de abajo está mal, y más
                vale que el alumno lo vea aquí que fiarse de un resultado falso. */}
            <div className="card bg-amber-500/5 border-amber-500/25 mb-4 space-y-2">
              {editingStatement === null ? (
                <>
                  <p className="text-xs text-amber-300/90 font-medium">
                    📖 Esto es lo que he leído de tu foto
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Si algún número o signo no coincide con tu ejercicio, corrígelo — el
                    resultado depende de ello.
                  </p>
                  <button
                    onClick={() => setEditingStatement(result.statement || '')}
                    className="btn-secondary btn-sm"
                  >
                    ✏️ Corregir enunciado
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-amber-300/90 font-medium">
                    ✏️ Corrige el enunciado y lo resuelvo de nuevo
                  </p>
                  <textarea
                    value={editingStatement}
                    onChange={e => setEditingStatement(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2
                               text-sm text-slate-100 font-mono focus:outline-none focus:border-primary-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingStatement(null)}
                      disabled={resolvingText}
                      className="btn-secondary flex-1 btn-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={resolverConTexto}
                      disabled={resolvingText}
                      className="btn-primary flex-1 btn-sm"
                    >
                      {resolvingText ? '⏳ Resolviendo...' : '✨ Resolver con esto'}
                    </button>
                  </div>
                </>
              )}
            </div>
            <ProblemsView result={{ problems: [result] }} />
          </>
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
                    <button
                      onClick={e => borrar(doc.id, e)}
                      title="Eliminar"
                      className="shrink-0 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <IconTrash size={16} />
                    </button>
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
