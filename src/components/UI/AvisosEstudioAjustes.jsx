import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TIPOS, leerTipos, guardarTipo } from '../../lib/avisosEstudio'

// Interruptores de los avisos de estudio (Ajustes de MyStudy App). En la web
// y en el escritorio no se pinta: allí no hay avisos locales.
export default function AvisosEstudioAjustes() {
  const { t } = useTranslation()
  const [tipos, setTipos] = useState(leerTipos)
  if (!window.Capacitor?.isNativePlatform?.()) return null

  const cambiar = (tipo) => {
    const activo = !tipos[tipo]
    setTipos(p => ({ ...p, [tipo]: activo }))
    guardarTipo(tipo, activo)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-200">{t('avisos.ajustesTitulo')}</p>
      {TIPOS.map(tipo => (
        <button key={tipo} onClick={() => cambiar(tipo)}
                className="w-full flex items-center justify-between gap-3 text-left">
          <span className="text-sm text-slate-300">{t(`avisos.tipo.${tipo}`)}</span>
          <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${tipos[tipo] ? 'bg-primary-600' : 'bg-slate-600'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${tipos[tipo] ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </span>
        </button>
      ))}
      <p className="text-xs text-slate-500">{t('avisos.ajustesNota')}</p>
    </div>
  )
}
