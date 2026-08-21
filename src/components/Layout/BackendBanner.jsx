import { useEffect, useState } from 'react'
import { useAppStore, api } from '../../store/appStore'
import { useTranslation } from 'react-i18next'

export default function BackendBanner() {
  const { t } = useTranslation()
  const { backendError, setBackendReady, setBackendError } = useAppStore()
  const [retrying, setRetrying] = useState(false)
  // El aviso solo tiene sentido cuando el arranque se hace notar. En la web el
  // /health responde en decimas y el banner aparecia y desaparecia en cada
  // recarga, dando sensacion de app rota. Si tarda mas de esto (backend
  // dormido, Electron levantando el servicio local) si conviene avisar.
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 1200)
    return () => clearTimeout(t)
  }, [])

  async function handleRetry() {
    setRetrying(true)
    setBackendError(null)
    try {
      await api('GET', '/health')
      setBackendReady(true)
    } catch {
      setBackendError(t('backend.stillNotResponding'))
    } finally {
      setRetrying(false)
    }
  }

  if (!slow && !backendError) return null

  return (
    <div className="bg-amber-950/60 border-b border-amber-700/50 px-4 py-2 flex items-center gap-3 text-sm text-amber-200">
      <span className={retrying ? 'animate-spin' : 'animate-pulse'}>⚙️</span>
      <span className="flex-1">
        {backendError ? backendError : t('backend.starting')}
      </span>
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="text-xs bg-amber-800/60 hover:bg-amber-700/60 px-3 py-1 rounded-lg
                   border border-amber-600/40 transition-colors disabled:opacity-50 disabled:cursor-wait"
      >
        {retrying ? t('backend.retrying') : t('backend.retry')}
      </button>
    </div>
  )
}
