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
  const { clearPasswordRecovery } = useAuth()
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [success, setSuccess]     = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError('No se pudo actualizar la contraseña. Inténtalo de nuevo.')
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
          <h1 className="text-2xl font-bold text-slate-100">Nueva contraseña</h1>
          <p className="text-slate-400 text-sm mt-2">Elige una contraseña segura para tu cuenta</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">

          {success ? (
            <div className="text-center space-y-4">
              <div className="text-5xl">✅</div>
              <p className="text-green-400 font-semibold">¡Contraseña actualizada!</p>
              <p className="text-slate-400 text-sm">Redirigiendo a la app…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm text-slate-400 mb-1">Nueva contraseña</label>
                <PasswordInput
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  autoFocus
                  autoComplete="new-password"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary-500 transition"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Repite la contraseña</label>
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
                {loading ? 'Guardando…' : 'Guardar nueva contraseña'}
              </button>

            </form>
          )}
        </div>
      </div>
    </div>
  )
}
