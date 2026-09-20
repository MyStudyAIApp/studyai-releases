import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { IconLoader2 } from '@tabler/icons-react'
import { suscribir } from './scanUpload'

/**
 * Como va el escaneo que el alumno dejo en segundo plano.
 *
 * Existe porque "Avisame" le deja sin saber nada hasta que llega la
 * notificacion: si vuelve al inicio, no hay ni rastro de que su libreta se
 * este subiendo. Esto lo hace visible sin obligarle a volver al escaner.
 *
 * No tiene estado propio a proposito: lee el del trabajo, que vive en
 * scanUpload fuera de React. Por eso sigue funcionando aunque la pantalla del
 * escaner se haya desmontado, que es justo el caso para el que se hizo.
 *
 * Solo se pinta MIENTRAS esta trabajando. Cuando termina desaparece: del
 * resultado ya avisa la notificacion, y una tarjeta que se queda ahi con algo
 * que ya paso es ruido en la pantalla de inicio.
 */
export default function ScanProgressCard() {
  const [trabajo, setTrabajo] = useState(null)
  const { t } = useTranslation()

  useEffect(() => suscribir(setTrabajo), [])

  // segundoPlano: si sigue en la pantalla del escaner, el progreso ya se ve
  // alli. Aqui solo interesa lo que dejo trabajando y perdio de vista.
  if (!trabajo || !trabajo.segundoPlano || trabajo.terminado) return null

  const { fase, actual, total, guardadas } = trabajo
  // Progreso sobre el TOTAL de la cola: cada pagina cuenta media al
  // reescalarse y entera al subirse. Si se encola otro escaneo, total crece y
  // la barra retrocede en porcentaje pero sigue avanzando en paginas, que es
  // lo honesto: de verdad queda mas trabajo que hace un segundo.
  const pct = Math.round(((guardadas + (fase === 'subiendo' ? 0.5 : 0)) / Math.max(total, 1)) * 100)

  return (
    <div className="mb-6 bg-slate-800/60 rounded-2xl px-4 py-3 border border-slate-700">
      <div className="flex items-center gap-3">
        <IconLoader2 size={22} className="text-primary-400 animate-spin shrink-0" />
        <p className="text-slate-200 text-sm flex-1 leading-snug">
          {t(fase === 'reescalando'
            ? 'mobile.scanner.progressResizing'
            : 'mobile.scanner.progressUploading', { actual, total })}
        </p>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-1.5 mt-3">
        <div className="bg-primary-500 h-1.5 rounded-full transition-all duration-300"
             style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
