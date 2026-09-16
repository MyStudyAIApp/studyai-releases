import { passwordProblem, PASSWORD_MIN } from './LoginPage'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
/**
 * ResetPasswordPage — se muestra cuando el usuario llega desde el enlace
 * de "Restablecer contraseña" del email. Supabase dispara el evento
 * PASSWORD_RECOVERY y el AuthContext activa isPasswordRecovery=true.
 */
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import PasswordInput from '../components/UI/PasswordInput'

export default function ResetPasswordPage() {
  useTranslation() // re-render al cambiar de idioma
  const { clearPasswordRecovery } = useAuth()
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [success, setSuccess]     = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const problema = passwordProblem(password)
    if (problema) {
      setError(i18n.t(`auth.err.pw${problema[0].toUpperCase()}${problema.slice(1)}`, { min: PASSWORD_MIN }))
      return
    }
    if (password !== confirm) {
      setError(i18n.t('resetPw.errMatch'))
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(i18n.t('resetPw.errUpdate'))
      return
    }

    setSuccess(true)
    // Esperar 2 segundos y volver a la app normal
    setTimeout(() => clearPasswordRecovery(), 2000)
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo / título */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔐</div>
          <h1 className="text-2xl font-bold text-slate-100">{i18n.t('settings.profile.newPassword')}</h1>
          <p className="text-slate-400 text-sm mt-2">{i18n.t('resetPw.subtitle')}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">

          {success ? (
            <div className="text-center space-y-4">
              <div className="text-5xl">✅</div>
              <p className="text-green-400 font-semibold">{i18n.t('resetPw.done')}</p>
              <p className="text-slate-400 text-sm">{i18n.t('resetPw.redirecting')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm text-slate-400 mb-1">{i18n.t('settings.profile.newPassword')}</label>
                <PasswordInput
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={i18n.t('auth.passwordHint', { min: PASSWORD_MIN })}
                  required
                  autoFocus
                  autoComplete="new-password"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary-500 transition"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">{i18n.t('settings.profile.repeatPassword')}</label>
                <PasswordInput
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary-500 transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-white bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? i18n.t('mobile.scanner.saving') : i18n.t('resetPw.save')}
              </button>

            </form>
          )}
        </div>
      </div>
    </div>
  )
}
