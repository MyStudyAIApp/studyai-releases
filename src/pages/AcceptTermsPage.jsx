/**
 * Aceptación de Condiciones para una cuenta recién creada.
 *
 * Por qué existe: "Continuar con Google" crea la cuenta sin pasar por el
 * formulario de registro, así que no hay ninguna casilla por el camino. Antes
 * se resolvía poniendo esa casilla también en la pestaña de Iniciar sesión,
 * lo que obligaba a marcarla a quien ya tenía cuenta — friccion inútil y
 * confusa. Ahora se entra de un clic y es aquí, al volver de Google y solo si
 * la cuenta acaba de nacer, donde se pide la aceptación y la declaración de
 * edad (art. 7.1 y 8.2 RGPD).
 *
 * Quien no acepte no entra: se cierra la sesión.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'

export default function AcceptTermsPage() {
  const { t } = useTranslation()
  const { acceptTerms, signOut, user } = useAuth()
  const [marcado, setMarcado] = useState(false)
  const [sinCorreos, setSinCorreos] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const confirmar = async () => {
    setGuardando(true); setError(null)
    try {
      await acceptTerms(sinCorreos)
    } catch {
      // Sin constancia guardada no se pasa: reintentar o salir.
      setError(t('auth.err.generic'))
      setGuardando(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-xl">
        <h1 className="text-xl font-bold mb-2">{t('auth.gateTitle')}</h1>
        <p className="text-sm text-slate-400 mb-5">
          {t('auth.gateBody', { email: user?.email ?? '' })}
        </p>

        <label className="flex items-start gap-2 text-sm text-slate-300 cursor-pointer mb-5">
          <input
            type="checkbox"
            checked={marcado}
            onChange={e => setMarcado(e.target.checked)}
            className="mt-1 accent-primary-500"
          />
          <span>
            {t('auth.accept')}{' '}
            <Link to="/terminos" className="text-primary-400 hover:text-primary-300 underline">{t('auth.terms')}</Link>
            {' '}{t('auth.and')}{' '}
            <Link to="/privacidad" className="text-primary-400 hover:text-primary-300 underline">{t('auth.privacy')}</Link>
            {t('auth.ageConfirm')}
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm text-slate-400 cursor-pointer mb-5">
          <input
            type="checkbox"
            checked={sinCorreos}
            onChange={e => setSinCorreos(e.target.checked)}
            className="mt-1 accent-primary-500"
          />
          <span>{t('auth.noWelcomeEmails')}</span>
        </label>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={confirmar}
          disabled={!marcado || guardando}
          className="w-full bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg"
        >
          {guardando ? '...' : t('auth.gateContinue')}
        </button>

        <button
          type="button"
          onClick={signOut}
          disabled={guardando}
          className="w-full text-slate-500 hover:text-slate-300 text-sm transition-colors mt-3"
        >
          {t('auth.gateCancel')}
        </button>
      </div>
    </div>
  )
}
