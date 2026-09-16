import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import { useAppStore } from '../../store/appStore'
import Modal from './Modal'

const CATEGORY_LABELS = {
  generation: 'generaciones (resúmenes, fichas, exámenes...)',
  podcasts: 'podcasts',
  voice_minutes: 'minutos de transcripción (apuntes de voz, idiomas)',
  scan_pages: 'páginas escaneadas (cuaderno, fotos de apuntes, resolver ejercicio)',
  cost_cap: 'límite de seguridad de la cuenta',
}

export default function QuotaExceededModal() {
  useTranslation() // re-render al cambiar de idioma
  const quotaExceeded = useAppStore(s => s.quotaExceeded)
  const closeQuotaExceeded = useAppStore(s => s.closeQuotaExceeded)
  const isCostCap = quotaExceeded?.category === 'cost_cap'

  return (
    <Modal open={!!quotaExceeded} onClose={closeQuotaExceeded} title={isCostCap ? `⚠️ ${i18n.t('quota.capTitle')}` : `🚀 ${i18n.t('quota.title')}`} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-300">{quotaExceeded?.message}</p>
        {!isCostCap && (
          <p className="text-xs text-slate-500">
            {i18n.t('quota.affects')} {i18n.t(`quota.cat.${quotaExceeded?.category}`, { defaultValue: CATEGORY_LABELS[quotaExceeded?.category] || i18n.t('quota.thisFeature') })}. {i18n.t('quota.renews')}
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <button onClick={closeQuotaExceeded} className="btn-secondary flex-1">
            {isCostCap ? i18n.t('quota.ok') : i18n.t('quota.stayFree')}
          </button>
          <a
            href={isCostCap
              ? 'mailto:support@mystudyai.eu?subject=Límite%20de%20seguridad%20de%20mi%20cuenta'
              : 'mailto:support@mystudyai.eu?subject=Quiero%20pasarme%20a%20Pro'}
            className="btn-primary flex-1 text-center"
          >
            {isCostCap ? `📩 ${i18n.t('quota.contact')}` : `✨ ${i18n.t('billing.goPro')}`}
          </a>
        </div>
      </div>
    </Modal>
  )
}
