import { useState, useEffect } from 'react'
import Modal from './Modal'
import { useAuth } from '../../contexts/AuthContext'
import { api, useAppStore } from '../../store/appStore'

// Mensaje del equipo (novedades, agradecimientos, avisos) que se muestra una
// sola vez por usuario al entrar -- se gestiona desde /admin ("Anuncios").
// Funciona igual en web, escritorio y MyStudy App (comparten este árbol de
// componentes); MyStudy Scan lo monta aparte en su propio router.
export default function AnnouncementModal() {
  const { user, loading: authLoading } = useAuth()
  const { backendReady } = useAppStore()
  const [announcement, setAnnouncement] = useState(null)

  useEffect(() => {
    if (!backendReady || authLoading || !user) return
    api('GET', '/announcements/current').then(r => setAnnouncement(r.announcement)).catch(() => {})
  }, [backendReady, authLoading, user])

  async function handleClose() {
    const id = announcement?.id
    setAnnouncement(null)
    if (id) api('POST', `/announcements/${id}/dismiss`).catch(() => {})
  }

  return (
    <Modal open={!!announcement} onClose={handleClose} title={announcement?.title || ''} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-300 whitespace-pre-line">{announcement?.message}</p>
        {announcement?.link_url && (
          <a href={announcement.link_url} target="_blank" rel="noopener noreferrer" className="text-primary-400 text-sm hover:underline">
            Saber más →
          </a>
        )}
        <button onClick={handleClose} className="btn-primary w-full">Entendido</button>
      </div>
    </Modal>
  )
}
