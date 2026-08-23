import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { guardarDescarga, mensajeDeGuardado } from '../lib/guardarEnElMovil'
import { Preferences } from '@capacitor/preferences'
import { useNavigate } from 'react-router-dom'
import { api, useAppStore } from '../store/appStore'
import { IconArrowLeft, IconHeadphones, IconMusic, IconDownload, IconTrash, IconLoader2 } from '@tabler/icons-react'

const LOCAL_INDEX_KEY = 'downloaded_podcasts'

async function readLocalIndex() {
  const { value } = await Preferences.get({ key: LOCAL_INDEX_KEY })
  return value ? JSON.parse(value) : []
}

async function writeLocalIndex(list) {
  await Preferences.set({ key: LOCAL_INDEX_KEY, value: JSON.stringify(list) })
}

export default function MobilePodcastsPage() {
  const [pending, setPending] = useState([])
  const [downloaded, setDownloaded] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const { addToast } = useAppStore()
  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [local, remote] = await Promise.all([
        readLocalIndex(),
        api('GET', '/podcasts/pending').catch(() => ({ items: [] })),
      ])
      setDownloaded(local)
      setPending(remote.items || [])
    } finally {
      setLoading(false)
    }
  }

  async function descargar(item) {
    setBusyId(item.id)
    try {
      // El audio ya viene con una URL firmada de Supabase — no hace falta pasar por el backend otra vez.
      const res = await fetch(item.url)
      if (!res.ok) throw new Error('No se pudo descargar el audio')
      const blob = await res.blob()
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      const path = `podcast_${item.id}.mp3`
      const guardado = await guardarDescarga({ path, data: base64 })
      const uri = guardado.uri

      const entry = { id: item.id, title: item.title, path, uri, directory: guardado.directory, downloadedAt: Date.now() }
      const newLocal = [entry, ...downloaded]
      await writeLocalIndex(newLocal)
      setDownloaded(newLocal)
      setPending(prev => prev.filter(p => p.id !== item.id))

      // Confirmar recogida — libera el buzón temporal en Supabase.
      await api('POST', `/podcasts/${item.id}/fetched`).catch(() => {})

      addToast(mensajeDeGuardado(guardado, 'El podcast'), 'success', 6000)
    } catch (e) {
      addToast(`No se pudo descargar: ${e.message}`, 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function borrar(entry) {
    try {
      // Los episodios guardados antes del 23/8/2026 estan en la carpeta privada;
      // los nuevos, en Documentos. El indice guarda cual, con Data por defecto.
      await Filesystem.deleteFile({ path: entry.path, directory: entry.directory || Directory.Data })
    } catch { /* ya no existía */ }
    const newLocal = downloaded.filter(d => d.id !== entry.id)
    await writeLocalIndex(newLocal)
    setDownloaded(newLocal)
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-12 pb-5">
        <button onClick={() => navigate('/')} className="text-slate-400 p-1"><IconArrowLeft size={22} /></button>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2"><IconHeadphones size={20} /> Mis podcasts</h1>
      </div>

      <div className="flex-1 flex flex-col px-5 gap-6 pb-8 overflow-y-auto">
        {loading && (
          <p className="text-center text-slate-500 text-sm py-8">Cargando…</p>
        )}

        {!loading && pending.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-300 mb-2">Esperando en tu cuenta</h2>
            <div className="space-y-2">
              {pending.map(item => (
                <div key={item.id} className="bg-slate-800 rounded-2xl px-4 py-3 flex items-center gap-3 border border-slate-700">
                  <IconHeadphones size={22} className="shrink-0 text-slate-300" />
                  <p className="flex-1 min-w-0 text-sm text-slate-200 truncate">{item.title}</p>
                  <button
                    onClick={() => descargar(item)}
                    disabled={busyId === item.id}
                    className="btn-primary btn-sm shrink-0"
                  >
                    {busyId === item.id ? <IconLoader2 size={16} className="animate-spin" /> : <span className="flex items-center gap-1.5"><IconDownload size={14} /> Descargar</span>}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-2">Descargados</h2>
          {!loading && downloaded.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-slate-700 py-8 px-4 text-center">
              <p className="text-slate-500 text-sm">
                Aún no tienes ningún podcast descargado. Genera uno desde un documento en el ordenador o la web, y elige "Enviar a mi móvil".
              </p>
            </div>
          )}
          <div className="space-y-3">
            {downloaded.map(entry => (
              <div key={entry.id} className="bg-slate-800 rounded-2xl px-4 py-3 border border-slate-700 space-y-2">
                <div className="flex items-center gap-3">
                  <IconMusic size={22} className="shrink-0 text-slate-300" />
                  <p className="flex-1 min-w-0 text-sm text-slate-200 truncate">{entry.title}</p>
                  <button onClick={() => borrar(entry)} className="text-slate-500 active:text-red-400 shrink-0"><IconTrash size={17} /></button>
                </div>
                <audio controls className="w-full h-9" src={Capacitor.convertFileSrc(entry.uri)} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
