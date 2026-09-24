import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
// Cartel de bienvenida en el primer arranque (web/escritorio) — sustituye al
// antiguo recorrido general por toda la app. Solo avisa de que existen
// tutoriales detallados por sección en Ajustes.
export default function WelcomeCard({ onScan, onSample, onGo, onClose }) {
  useTranslation() // re-render al cambiar de idioma
  return (
    <div className="fixed inset-0" style={{ zIndex: 9999 }}>
      <div className="absolute inset-0 bg-black/72" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center px-6" style={{ zIndex: 10001 }}>
        <div className="card border-primary-600/60 shadow-2xl max-w-sm text-center" onClick={e => e.stopPropagation()}>
          <span className="text-5xl">🎓</span>
          <h2 className="text-xl font-bold text-slate-100 mt-3">{i18n.t('welcome.title')}</h2>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">{i18n.t('welcome.body1')}</p>
          <button onClick={onScan}
            className="w-full mt-5 px-4 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-base font-bold transition-colors">
            {i18n.t('welcome.scanCta')}
          </button>
          <p className="text-xs text-slate-400 mt-2">{i18n.t('welcome.scanHint')}</p>
          <button onClick={onSample}
            className="w-full mt-4 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-600 hover:border-primary-500 text-slate-200 text-sm font-semibold transition-colors">
            {i18n.t('welcome.sampleCta')}
          </button>
          <p className="text-xs text-slate-400 mt-2">{i18n.t('welcome.sampleHint')}</p>
          <div className="flex items-center justify-center gap-4 mt-4 text-xs">
            <button onClick={onGo} className="text-slate-400 hover:text-slate-200 underline">{i18n.t('welcome.tutorials')}</button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200 underline">{i18n.t('welcome.later')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
