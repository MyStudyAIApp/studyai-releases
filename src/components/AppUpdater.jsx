import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import {
  AppUpdate, AppUpdateAvailability, FlexibleUpdateInstallStatus,
} from '@capawesome/capacitor-app-update'
import { IconDownload, IconRefresh, IconX } from '@tabler/icons-react'

// Las dos apps llevan la web dentro, asi que cualquier cambio solo llega con una version nueva
// de Play, y nadie entra en Play a mirar si la hay. Play Core si lo sabe: se le pregunta al abrir
// y al volver del segundo plano.
//
// Avisa sin bloquear: franja abajo con "Actualizar", la descarga va en segundo plano y al terminar
// "Reiniciar" la instala. Solo se fuerza si en Play Console la version lleva prioridad alta (4-5),
// que es para lo que existe: un fallo grave que no puede esperar. La X la oculta hasta la proxima
// vez que se abra la app (el estado vive en memoria, no se guarda).
export default function AppUpdater() {
  const { t } = useTranslation()
  const [estado, setEstado] = useState(null) // null | 'disponible' | 'descargando' | 'lista'

  useEffect(() => {
    // Play Core solo existe en Android, y solo responde si la app viene de Play.
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return

    let ocupado = false
    const check = async () => {
      if (ocupado) return
      ocupado = true
      try {
        const info = await AppUpdate.getAppUpdateInfo()
        if (info.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) {
          setEstado('lista')
          return
        }
        if (info.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) return
        if ((info.updatePriority ?? 0) >= 4 && info.immediateUpdateAllowed) {
          await AppUpdate.performImmediateUpdate()
        } else if (info.flexibleUpdateAllowed) {
          setEstado((e) => e || 'disponible')
        }
      } catch {
        /* sin Play detras o sin red: se reintenta la proxima vez */
      } finally {
        ocupado = false
      }
    }

    check()
    // Nunca await sobre el plugin en si (ver reference_capacitor_trampas): solo sobre sus metodos.
    const oyentes = [
      App.addListener('appStateChange', ({ isActive }) => { if (isActive) check() }),
      AppUpdate.addListener('onFlexibleUpdateStateChange', ({ installStatus }) => {
        if (installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) setEstado('lista')
      }),
    ]
    return () => { oyentes.forEach((p) => p.then((l) => l.remove())) }
  }, [])

  if (!estado) return null

  const actualizar = async () => {
    setEstado('descargando')
    try {
      await AppUpdate.startFlexibleUpdate()
    } catch {
      setEstado('disponible') // el usuario cancelo el dialogo de Play
    }
  }

  return (
    // Por encima de la barra inferior de las dos apps (~4 rem) y de la zona segura del sistema.
    <div className="fixed left-3 right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-lg">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-600 text-white shadow-lg">
        {estado === 'lista' ? <IconRefresh size={20} className="shrink-0" /> : <IconDownload size={20} className="shrink-0" />}
        <p className="flex-1 text-sm font-medium">
          {estado === 'disponible' && t('appUpdate.available')}
          {estado === 'descargando' && t('appUpdate.downloading')}
          {estado === 'lista' && t('appUpdate.ready')}
        </p>
        {estado === 'disponible' && (
          <>
            <button onClick={actualizar} className="px-3 py-1.5 rounded-xl bg-white text-emerald-700 text-sm font-semibold">
              {t('appUpdate.update')}
            </button>
            <button onClick={() => setEstado(null)} aria-label={t('appUpdate.later')} className="p-1 text-white/80">
              <IconX size={16} />
            </button>
          </>
        )}
        {estado === 'lista' && (
          <button onClick={() => AppUpdate.completeFlexibleUpdate()} className="px-3 py-1.5 rounded-xl bg-white text-emerald-700 text-sm font-semibold">
            {t('appUpdate.restart')}
          </button>
        )}
      </div>
    </div>
  )
}
