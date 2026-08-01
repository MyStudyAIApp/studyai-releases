import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Barra de actualización discreta — aparece en la parte inferior cuando
 * hay una versión nueva disponible. El usuario controla cuándo descarga
 * y cuándo instala.
 *
 * Estados: idle → available → downloading → downloaded → (instala y reinicia)
 */
export default function UpdateNotification() {
  const { t } = useTranslation()
  const [state, setState] = useState('idle')      // idle | available | downloading | downloaded | error
  const [info, setInfo]   = useState(null)        // { version, releaseDate }
  const [progress, setProgress] = useState(0)     // 0-100
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!window.electron?.updater) return  // no disponible en web/dev

    const unsubAvailable  = window.electron.updater.onAvailable((i) => {
      setInfo(i)
      setState('available')
      setDismissed(false)
    })
    const unsubProgress   = window.electron.updater.onProgress((p) => {
      setProgress(p.percent)
      setState('downloading')
    })
    const unsubDownloaded = window.electron.updater.onDownloaded((i) => {
      setInfo(i)
      setState('downloaded')
    })
    const unsubError      = window.electron.updater.onError(() => {
      setState('error')
    })

    return () => {
      unsubAvailable?.()
      unsubProgress?.()
      unsubDownloaded?.()
      unsubError?.()
    }
  }, [])

  // No mostrar nada si no hay actualización o el usuario la descartó
  if (state === 'idle' || dismissed) return null

  const handleDownload = async () => {
    setState('downloading')
    setProgress(0)
    await window.electron.updater.download()
  }

  const handleInstall = () => {
    window.electron.updater.install()
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full animate-in slide-in-from-bottom-4">
      <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-4">

        {/* Encabezado */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔄</span>
            <div>
              <p className="text-sm font-semibold text-slate-100">
                {state === 'downloaded'
                  ? 'Lista para instalar'
                  : state === 'downloading'
                  ? 'Descargando...'
                  : state === 'error'
                  ? 'Error de actualización'
                  : 'Nueva versión disponible'}
              </p>
              {info?.version && (
                <p className="text-xs text-slate-400">Versión {info.version}</p>
              )}
            </div>
          </div>

          {/* Botón cerrar (solo cuando hay disponible o error) */}
          {(state === 'available' || state === 'error') && (
            <button
              onClick={() => setDismissed(true)}
              className="text-slate-500 hover:text-slate-300 text-lg leading-none ml-2"
              title="Cerrar"
            >×</button>
          )}
        </div>

        {/* Barra de progreso */}
        {state === 'downloading' && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Descargando actualización</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Puedes seguir usando la app mientras se descarga
            </p>
          </div>
        )}

        {/* Mensaje de error */}
        {state === 'error' && (
          <p className="text-xs text-red-400 mb-3">
            No se pudo descargar la actualización. Inténtalo más tarde.
          </p>
        )}

        {/* Botones de acción */}
        <div className="flex gap-2">
          {state === 'available' && (
            <>
              <button
                onClick={handleDownload}
                className="flex-1 bg-primary-600 hover:bg-primary-500 text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors"
              >
                Descargar ahora
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Más tarde
              </button>
            </>
          )}

          {state === 'downloaded' && (
            <>
              <button
                onClick={handleInstall}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors"
              >
                Instalar y reiniciar
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Más tarde
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
