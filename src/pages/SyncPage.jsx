import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useAppStore, api } from '../store/appStore'
import { runSync, restoreToCloud, pullFromCloud } from '../services/syncService'

export default function SyncPage() {
  const { user } = useAuth()
  const { addToast } = useAppStore()
  const [docs,     setDocs]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [syncing,  setSyncing]  = useState(false)
  const [progress, setProgress] = useState(null)  // { total, current }

  useEffect(() => { loadDocs() }, [])

  async function loadDocs() {
    setLoading(true)
    try {
      const { items } = await api('GET', '/documents?limit=1000')
      setDocs(items || [])
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }

  const pending        = docs.filter(d => !d.supabase_id && d.sync_status !== 'deleted_from_web')
  const synced         = docs.filter(d => d.supabase_id && d.sync_status === 'synced')
  const deletedFromWeb = docs.filter(d => d.sync_status === 'deleted_from_web')

  async function handleSync() {
    if (syncing) return
    setSyncing(true)
    setProgress({ total: 0, current: 0 })
    const result = await runSync(user, p => setProgress(p))
    const pulled = await pullFromCloud(user)
    setSyncing(false)
    setProgress(null)
    await loadDocs()

    const messages = []
    if (result.synced > 0) messages.push(`${result.synced} subido(s) ☁️`)
    if (pulled.downloaded > 0) messages.push(`${pulled.downloaded} descargado(s) ⬇️`)
    if (result.deletedFromWeb > 0) messages.push(`${result.deletedFromWeb} borrado(s) detectado(s)`)

    const totalErrors = result.errors + pulled.errors
    if (totalErrors > 0)
      addToast(`Sincronizado con ${totalErrors} error(es)`, 'warning')
    else if (messages.length > 0)
      addToast(messages.join(' · '), 'success')
    else
      addToast('Todo al día ✓', 'success')
  }

  async function handleRestore(doc) {
    const ok = await restoreToCloud(user, doc)
    if (ok) {
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, sync_status: 'synced' } : d))
      addToast('Documento restaurado en la web ☁️', 'success')
    } else {
      addToast('No se pudo restaurar', 'error')
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-slate-100 mb-1">Sincronización</h1>
      <p className="text-sm text-slate-400 mb-6">
        Sube tus documentos a la nube y descarga aquí los que hayas subido desde la web o el móvil — todo con la misma cuenta.
      </p>

      {/* Contadores */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-800 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-amber-400">{loading ? '…' : pending.length}</div>
          <div className="text-xs text-slate-400 mt-1">⬆️ Pendiente{pending.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-emerald-400">{loading ? '…' : synced.length}</div>
          <div className="text-xs text-slate-400 mt-1">☁️ En la nube</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-blue-400">{loading ? '…' : deletedFromWeb.length}</div>
          <div className="text-xs text-slate-400 mt-1">💾 Solo en PC</div>
        </div>
      </div>

      {/* Botón sincronizar */}
      <button
        onClick={handleSync}
        disabled={syncing || loading}
        className="btn-primary w-full mb-8 disabled:opacity-50 text-base py-3"
      >
        {syncing
          ? `⏳ Sincronizando${progress?.total > 0 ? ` ${progress.current} / ${progress.total}` : '...'}`
          : '☁️ Sincronizar ahora'}
      </button>

      {/* Solo en PC (borrados de la web) */}
      {deletedFromWeb.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            💾 Solo en este ordenador
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            Fueron borrados desde la web. Siguen en tu PC. Puedes volver a subirlos.
          </p>
          <div className="space-y-2">
            {deletedFromWeb.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-4 py-2.5">
                <span className="text-slate-400 shrink-0">
                  {doc.file_type === 'foto' ? '🖼️' : doc.file_type === 'escaneado' ? '📷' : '📄'}
                </span>
                <span className="flex-1 text-sm text-slate-300 truncate">{doc.title}</span>
                <button
                  onClick={() => handleRestore(doc)}
                  className="text-xs bg-blue-800/60 text-blue-300 border border-blue-600 rounded px-2.5 py-1 hover:bg-blue-700 transition-colors shrink-0"
                >↑ Volver a subir</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pendientes */}
      {!loading && pending.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            ⬆️ Pendientes de subir
          </h2>
          <div className="space-y-1">
            {pending.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-2 rounded-lg">
                <span className="text-slate-600 shrink-0">
                  {doc.file_type === 'foto' ? '🖼️' : doc.file_type === 'escaneado' ? '📷' : '📄'}
                </span>
                <span className="flex-1 text-sm text-slate-500 truncate">{doc.title}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Ya sincronizados */}
      {!loading && synced.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            ☁️ Ya en la nube
          </h2>
          <div className="space-y-1">
            {synced.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-2 rounded-lg">
                <span className="text-slate-600 shrink-0">
                  {doc.file_type === 'foto' ? '🖼️' : doc.file_type === 'escaneado' ? '📷' : '📄'}
                </span>
                <span className="flex-1 text-sm text-slate-500 truncate">{doc.title}</span>
                <span className="text-xs text-emerald-500">✓</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!loading && docs.length === 0 && (
        <p className="text-center text-slate-500 py-12">No tienes documentos todavía.</p>
      )}
    </div>
  )
}
