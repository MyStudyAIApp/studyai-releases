import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Browser } from '@capacitor/browser'
import { supabase } from '../lib/supabase'
import { getGoogleOAuthUrl } from '../lib/googleAuth'
import { useAuth } from '../contexts/AuthContext'
import Logo from '../components/UI/Logo'

export default function MobileLoginPage() {
  const { user } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const navigate                = useNavigate()

  // El login con Google se completa en segundo plano (deep link, ver
  // MobileApp.jsx) sin pasar por este componente -- aquí solo hace falta
  // reaccionar en cuanto `user` pase de null a tener valor y navegar.
  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user])

  const loginWithGoogle = async () => {
    setError('')
    try {
      const url = await getGoogleOAuthUrl()
      await Browser.open({ url })
    } catch (err) {
      setError('No se pudo iniciar sesión con Google. Inténtalo de nuevo.')
    }
  }

  const login = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err
      navigate('/')
    } catch (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos'
        : err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-10 text-center">
        <h1><Logo size="xl" subtitle="Scan" /></h1>
        <p className="text-slate-400 mt-1 text-sm">Escanea y graba tus apuntes</p>
      </div>

      {/* Info MyStudy AI */}
      <div className="w-full max-w-sm bg-slate-800/70 rounded-2xl px-4 py-4 mb-6">
        <p className="text-sm text-slate-400 text-center">
          Esta app es el complemento móvil de MyStudy AI. Para la experiencia completa visita{' '}
          <a href="https://mystudyai.eu" target="_blank" rel="noopener noreferrer"
            className="text-primary-400 font-medium">mystudyai.eu</a>
        </p>
      </div>

      {/* Formulario */}
      <form onSubmit={login} className="w-full max-w-sm space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full px-4 py-4 rounded-xl bg-slate-800 text-slate-100 placeholder-slate-500
                     border border-slate-700 focus:border-primary-500 outline-none text-base"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="w-full px-4 py-4 rounded-xl bg-slate-800 text-slate-100 placeholder-slate-500
                     border border-slate-700 focus:border-primary-500 outline-none text-base"
        />

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-xl bg-primary-600 text-white font-bold text-base
                     active:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Entrando...' : 'Iniciar sesión'}
        </button>
      </form>

      {/* Separador */}
      <div className="w-full max-w-sm flex items-center gap-3 my-5">
        <div className="h-px flex-1 bg-slate-700" />
        <span className="text-xs text-slate-500">o</span>
        <div className="h-px flex-1 bg-slate-700" />
      </div>

      <button
        type="button"
        onClick={loginWithGoogle}
        className="w-full max-w-sm flex items-center justify-center gap-3 bg-white active:bg-slate-100
                   text-slate-800 font-bold py-4 rounded-xl transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M23.52 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.73z"/>
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.9l-3.88-3c-1.08.72-2.45 1.15-4.05 1.15-3.11 0-5.75-2.1-6.69-4.92H1.3v3.09C3.26 21.3 7.31 24 12 24z"/>
          <path fill="#FBBC05" d="M5.31 14.33A7.2 7.2 0 0 1 4.93 12c0-.81.14-1.6.38-2.33V6.58H1.3A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.3 5.42l4.01-3.09z"/>
          <path fill="#EA4335" d="M12 4.75c1.76 0 3.35.61 4.6 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.3 6.58l4.01 3.09C6.25 6.85 8.89 4.75 12 4.75z"/>
        </svg>
        Continuar con Google
      </button>

      <p className="text-slate-500 text-xs mt-8 text-center">
        Para crear una cuenta, usa la versión web de MyStudy AI
      </p>
    </div>
  )
}
