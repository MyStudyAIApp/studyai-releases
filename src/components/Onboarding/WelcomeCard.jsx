import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
// Cartel de bienvenida en el primer arranque (web/escritorio) — sustituye al
// antiguo recorrido general por toda la app. Solo avisa de que existen
// tutoriales detallados por sección en Ajustes.
export default function WelcomeCard({ onGo, onClose }) {
  useTranslation() // re-render al cambiar de idioma
  return (
    <div className="fixed inset-0" style={{ zIndex: 9999 }}>
      <div className="absolute inset-0 bg-black/72" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center px-6" style={{ zIndex: 10001 }}>
        <div className="card border-primary-600/60 shadow-2xl max-w-sm text-center" onClick={e => e.stopPropagation()}>
          <span className="text-5xl">🎓</span>
          <h2 className="text-xl font-bold text-slate-100 mt-3">{i18n.t('welcome.title')}</h2>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            {i18n.t('welcome.body1')}
            {'\n\n'}{i18n.t('welcome.body2')}
          </p>
          <div className="flex items-center justify-center gap-3 mt-5">
            <button onClick={onClose} className="btn-secondary text-sm px-4 py-2">{i18n.t('common.close')}</button>
            <button onClick={onGo}
              className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-bold transition-colors">
              Ir a tutoriales →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
