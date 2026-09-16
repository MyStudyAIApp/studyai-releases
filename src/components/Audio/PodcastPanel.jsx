import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import { useState } from 'react'
import { useAppStore, getAuthHeader, getLocalAuthHeader, IS_MOBILE } from '../../store/appStore'
import { WEB_API } from '../../lib/supabase'

// Todos los podcasts, se generen desde donde se generen (escritorio, web o
// MyStudy App), pasan por el mismo buzón temporal en Supabase y se recogen
// SIEMPRE en la pantalla "Mis podcasts" de MyStudy Scan — es el único sitio
// donde viven, para no tener audios sueltos por cada app. MyStudy Scan no
// usa este componente (tiene su propio botón en MobileLibraryPage.jsx que ya
// hace lo mismo directamente), así que aquí solo hay dos casos: en el propio
// escritorio/web se puede además descargar directamente al ordenador.
export default function PodcastPanel({ doc, onClose }) {
  useTranslation() // re-render al cambiar de idioma
  const { apiBase, addToast, podcastVoice } = useAppStore()
  const [downloading, setDownloading] = useState(false)
  const [sending, setSending] = useState(false)
  // El guion del podcast siempre se genera en español -- usamos la voz que
  // el usuario tenga elegida en Ajustes para español, así suena igual que
  // el resto de lecturas en voz alta de la app.

  async function downloadHere() {
    setDownloading(true)
    try {
      const authHeader = await getAuthHeader()
      const localHeader = await getLocalAuthHeader()
      const res = await fetch(`${apiBase}/documents/${doc.id}/podcast?voice=${encodeURIComponent(podcastVoice)}`, {
        method: 'POST',
        headers: { ...authHeader, ...localHeader },
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc.title || 'podcast'}.mp3`
      a.click()
      URL.revokeObjectURL(url)
      addToast('Podcast descargado', 'success')
      onClose?.()
    } catch (e) {
      addToast(`${i18n.t('mobile.library.podcastError')}: ${e.message}`, 'error')
    } finally {
      setDownloading(false)
    }
  }

  async function sendToMobile() {
    setSending(true)
    try {
      const authHeader = await getAuthHeader()
      if (!authHeader.Authorization) {
        addToast('Inicia sesión con tu cuenta para guardarlo', 'warning')
        return
      }
      const res = await fetch(`${WEB_API}/documents/${doc.id}/podcast/send-to-mobile?voice=${encodeURIComponent(podcastVoice)}`, {
        method: 'POST',
        headers: { ...authHeader },
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `HTTP ${res.status}`)
      addToast('Listo — ábrelo en "Mis podcasts" desde MyStudy Scan', 'success', 6000)
      onClose?.()
    } catch (e) {
      addToast(`${i18n.t('mobile.library.podcastError')}: ${e.message}`, 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">
        {i18n.t('podcast.intro1')} <span className="text-slate-200 font-medium">"{doc.title}"</span> {i18n.t('podcast.intro2')}
      </p>

      <div className="space-y-2">
        {!IS_MOBILE && (
          <button
            onClick={downloadHere}
            disabled={downloading || sending}
            className="w-full btn-secondary flex items-center gap-3 justify-start py-3"
          >
            <span className="text-xl">⬇️</span>
            <div className="text-left">
              <p className="font-medium text-sm">{downloading ? i18n.t('library.generating') : i18n.t('podcast.downloadHere')}</p>
              <p className="text-xs text-slate-400">{i18n.t('podcast.savedHere')}</p>
            </div>
            {downloading && <span className="ml-auto animate-spin">⟳</span>}
          </button>
        )}

        <button
          onClick={sendToMobile}
          disabled={downloading || sending}
          className="w-full btn-secondary flex items-center gap-3 justify-start py-3"
        >
          <span className="text-xl">🎧</span>
          <div className="text-left">
            <p className="font-medium text-sm">{sending ? i18n.t('library.generating') : i18n.t('podcast.saveMine')}</p>
            <p className="text-xs text-slate-400">{i18n.t('podcast.openFrom')}</p>
          </div>
          {sending && <span className="ml-auto animate-spin">⟳</span>}
        </button>
      </div>

      <p className="text-xs text-slate-500 pt-1">
        💡 {i18n.t('podcast.tip')}
      </p>
    </div>
  )
}
