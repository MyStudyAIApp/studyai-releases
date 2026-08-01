import { useAppStore } from '../../store/appStore'
import Modal from './Modal'

const CATEGORY_LABELS = {
  generation: 'generaciones (resúmenes, fichas, exámenes...)',
  voice_minutes: 'minutos de voz/visión (apuntes de voz, idiomas, resolver ejercicio)',
  cost_cap: 'límite de seguridad de la cuenta',
}

export default function QuotaExceededModal() {
  const quotaExceeded = useAppStore(s => s.quotaExceeded)
  const closeQuotaExceeded = useAppStore(s => s.closeQuotaExceeded)
  const isCostCap = quotaExceeded?.category === 'cost_cap'

  return (
    <Modal open={!!quotaExceeded} onClose={closeQuotaExceeded} title={isCostCap ? '⚠️ Límite de seguridad alcanzado' : '🚀 Cupo agotado'} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-300">{quotaExceeded?.message}</p>
        {!isCostCap && (
          <p className="text-xs text-slate-500">
            Esto afecta a {CATEGORY_LABELS[quotaExceeded?.category] || 'esta función'}. El cupo se renueva pasados 30 días desde tu primer uso.
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <button onClick={closeQuotaExceeded} className="btn-secondary flex-1">
            {isCostCap ? 'Entendido' : 'Seguir en Free'}
          </button>
          <a
            href={isCostCap
              ? 'mailto:support@mystudyai.eu?subject=Límite%20de%20seguridad%20de%20mi%20cuenta'
              : 'mailto:support@mystudyai.eu?subject=Quiero%20pasarme%20a%20Pro'}
            className="btn-primary flex-1 text-center"
          >
            {isCostCap ? '📩 Contactar soporte' : '✨ Hazte Pro'}
          </a>
        </div>
      </div>
    </Modal>
  )
}
