/**
 * MyStudy AI — Página de Login y Registro
 * ======================================
 * Pantalla que ve el usuario cuando no está logueado.
 * Tiene dos modos: "iniciar sesión" y "crear cuenta".
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase, WEB_API } from '../lib/supabase'
import { IS_WEB, IS_ELECTRON, IS_MOBILE } from '../store/appStore'
import { App as CapacitorApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { useAuth } from '../contexts/AuthContext'
import { getGoogleOAuthUrl, completeNativeAuthFromUrl, startNativePasswordRecovery } from '../lib/googleAuth'
import { useTurnstile } from '../hooks/useTurnstile'
import Logo from '../components/UI/Logo'
import PasswordInput from '../components/UI/PasswordInput'
import { IconBrandInstagram, IconBrandFacebook, IconBrandTiktok, IconBrandYoutube } from '@tabler/icons-react'

const SOCIAL_LINKS = [
  { Icon: IconBrandInstagram, href: 'https://instagram.com/mystudyaiapp', label: 'Instagram' },
  { Icon: IconBrandFacebook,  href: 'https://facebook.com/1264908873368210', label: 'Facebook' },
  { Icon: IconBrandTiktok,    href: 'https://tiktok.com/@mystudy.ai', label: 'TikTok' },
  { Icon: IconBrandYoutube,   href: 'https://youtube.com/@mystudyai-h6p', label: 'YouTube' },
]

export default function LoginPage() {
  const { user, beginPasswordRecovery } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // En cuanto el login tiene éxito, user pasa de null a tener valor → ir al
  // destino de donde venía (ej. /admin si el candado de MyStudy Admin está
  // activo, o de donde ProtectedRoute redirigió) -- si no hay ninguno, /home.
  useEffect(() => {
    if (!user) return
    const isAdminLockedApp = localStorage.getItem('studyai_admin_lock') === '1'
    navigate(isAdminLockedApp ? '/admin' : (location.state?.from || '/home'), { replace: true })
  }, [user])
  const [mode, setMode]         = useState('login')   // 'login' | 'register' | 'sent' | 'confirmed'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [name, setName]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [resetSent, setResetSent] = useState(false)
  const [acceptedTerms, setAcceptedTerms]   = useState(false)
  // Región fiscal (solo compras web vía Stripe): se guarda en localStorage y
  // useBillingRegion la sincroniza a profiles.settings en cuanto haya sesión
  // -- signUp() todavía no la tiene, la confirmación por email es posterior.
  const [billingRegion, setBillingRegion]   = useState('')
  function chooseBillingRegion(value) {
    setBillingRegion(value)
    localStorage.setItem('billing_region_pending', value)
  }
  // Widget anti-bot compartido con MobileLoginPage (ver src/hooks/useTurnstile.js)
  const turnstile = useTurnstile(mode === 'login' || mode === 'register')

  // Detectar callbacks de Supabase en el hash de la URL (#access_token=... o #error=...)
  useEffect(() => {
    if (!IS_WEB) return
    const hash = window.location.hash
    if (!hash) return
    const params = new URLSearchParams(hash.slice(1))
    const errorCode = params.get('error_code')
    const type = params.get('type')
    if (errorCode === 'otp_expired' || errorCode === 'otp_disabled') {
      setError('El enlace de confirmación ha caducado. Regístrate de nuevo o usa el inicio de sesión con contraseña.')
    } else if (params.get('error')) {
      setError('El enlace no es válido. Inténtalo de nuevo.')
    } else if (type === 'signup' && params.get('access_token')) {
      setMode('confirmed')
    }
    // Limpiar el hash para que no persista en recarga
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  // En Electron no hay navegador propio: abrimos el del sistema y esperamos
  // el deep link de vuelta (mystudyai://auth-callback), ver src/lib/googleAuth.js
  useEffect(() => {
    if (IS_WEB || !window.electron?.onDeepLink) return
    const off = window.electron.onDeepLink(async (url) => {
      try {
        const { ok, isRecovery } = await completeNativeAuthFromUrl(url)
        if (!ok) setError(isRecovery
          ? 'El enlace de la contraseña ha caducado. Pide uno nuevo.'
          : 'No se pudo completar el login con Google.')
        else if (isRecovery) beginPasswordRecovery()
      } catch {
        setError('No se pudo completar la operación. Inténtalo de nuevo.')
      }
    })
    return off
  }, [])

  // MyStudy App (Capacitor): mismo problema, sin navegador propio — abrimos
  // el del sistema (Browser.open) y escuchamos el deep link vía appUrlOpen
  // (igual que MobileApp.jsx, que cubre MyStudy Scan).
  useEffect(() => {
    if (!IS_MOBILE) return
    const listenerPromise = CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
      try {
        const { ok, isRecovery } = await completeNativeAuthFromUrl(url)
        if (ok) {
          try { await Browser.close() } catch {}
          if (isRecovery) beginPasswordRecovery()
        } else setError(isRecovery
          ? 'El enlace de la contraseña ha caducado. Pide uno nuevo.'
          : 'No se pudo completar el login con Google.')
      } catch {
        setError('No se pudo completar la operación. Inténtalo de nuevo.')
      }
    })
    return () => { listenerPromise.then(l => l.remove()) }
  }, [])

  const handleGoogleLogin = async () => {
    setError(null)
    // El alta con Google crea la cuenta igual que el formulario de email, asi
    // que tiene que pasar por la misma aceptacion de Condiciones y Privacidad.
    // Sin esto se podian crear cuentas sin contrato aceptado (art. 13 RGPD).
    if (mode === 'register' && !acceptedTerms) {
      setError('Debes aceptar los Términos y la Política de Privacidad para crear una cuenta.')
      return
    }
    if (IS_WEB) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) setError('No se pudo iniciar sesión con Google. Inténtalo de nuevo.')
      return
    }
    try {
      const url = await getGoogleOAuthUrl()
      if (IS_MOBILE) await Browser.open({ url })
      else await window.electron.shell.openExternal(url)
    } catch {
      setError('No se pudo iniciar sesión con Google. Inténtalo de nuevo.')
    }
  }

  const handleForgotPassword = async () => {
    if (!email) { setError('Escribe tu email primero.'); return }
    if (turnstile.enabled && !turnstile.token) {
      setError('Completa la verificación de seguridad.')
      return
    }
    setLoading(true); setError(null)
    try {
      if (IS_WEB) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
          ...(turnstile.enabled ? { captchaToken: turnstile.token } : {}),
        })
        if (error) throw error
      } else {
        // Escritorio y móvil: el enlace debe volver A LA APP, no a la web. Con
        // PKCE el código solo se canjea donde se guardó el verificador; si abre
        // el navegador, falla en silencio y el usuario acaba en la landing sin
        // poder cambiar nada (ver src/lib/googleAuth.js).
        await startNativePasswordRecovery(email, turnstile.token)
      }
      setResetSent(true)
    } catch {
      setError('No se pudo enviar el email. Inténtalo de nuevo.')
    } finally {
      turnstile.reset()   // el token se consume en cada intento, salga bien o mal
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'login') {
        // ── Iniciar sesión ────────────────────────────────────────
        if (turnstile.enabled && !turnstile.token) {
          setError('Completa la verificación de seguridad.')
          setLoading(false)
          return
        }
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
          ...(turnstile.enabled ? { options: { captchaToken: turnstile.token } } : {})
        })
        if (error) throw error
        // Si funciona, el AuthContext detecta el cambio y redirige automáticamente

      } else {
        // ── Crear cuenta ──────────────────────────────────────────
        if (password !== passwordConfirm) {
          setError('Las contraseñas no coinciden.')
          setLoading(false)
          return
        }
        if (!acceptedTerms) {
          setError('Debes aceptar los Términos y la Política de Privacidad para crear una cuenta.')
          setLoading(false)
          return
        }
        if (turnstile.enabled && !turnstile.token) {
          setError('Completa la verificación de seguridad.')
          setLoading(false)
          return
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            ...(IS_WEB ? { emailRedirectTo: window.location.origin } : {}),
            ...(turnstile.enabled ? { captchaToken: turnstile.token } : {})
          }
        })
        if (error) throw error
        setMode('sent')  // mostrar mensaje "revisa tu email"
      }
    } catch (err) {
      // Traducir los errores más comunes al español
      const msg = err.message || ''
      if (msg.includes('Invalid login credentials'))
        setError('Email o contraseña incorrectos.')
      else if (msg.includes('Email not confirmed'))
        setError('Confirma tu email primero. Revisa tu bandeja de entrada.')
      else if (msg.includes('User already registered'))
        setError('Ya existe una cuenta con ese email. Inicia sesión.')
      else if (msg.includes('Password should be at least'))
        setError('La contraseña debe tener al menos 6 caracteres.')
      // El registro se cierra en Supabase (Authentication -> "Allow new users
      // to sign up"), no en la interfaz: ocultar el formulario no impedia nada,
      // y de hecho por el boton de Google se colaron dos cuentas. Cuando esta
      // cerrado, Supabase responde con estos mensajes: hay que traducirlos a
      // algo que el usuario entienda.
      else if (msg.includes('Signups not allowed') || msg.includes('signup is disabled') || msg.includes('Sign ups not allowed'))
        setError('El registro está cerrado durante la fase beta. Escríbenos a support@mystudyai.eu si quieres participar.')
      // El cierre de la beta vive en la base de datos (trigger
      // comprobar_invitacion_beta sobre auth.users, con la lista
      // public.beta_invitados). Cuando rechaza, Supabase devuelve este mensaje
      // generico, asi que hay que traducirlo aqui.
      else if (msg.includes('Database error saving new user'))
        setError('El registro está cerrado durante la fase beta. Escríbenos a support@mystudyai.eu si quieres participar.')
      else
        setError(msg || 'Ha ocurrido un error. Inténtalo de nuevo.')
      // El token de Turnstile es de un solo uso -- si el intento falló hay que
      // resetear el widget para que el usuario pueda reintentar
      turnstile.reset()
    } finally {
      setLoading(false)
    }
  }

  // Barra de título mínima para Electron (sin ella no se puede cerrar/mover)
  // — OJO: solo Electron, no "!IS_WEB" a secas (eso también incluye la app
  // móvil completa de Capacitor, que no tiene ventana que minimizar/cerrar).
  const ElectronTitleBar = IS_ELECTRON && (
    <div className="titlebar-drag fixed top-0 left-0 right-0 h-10 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 select-none z-50">
      <Logo size="sm" />
      <div className="titlebar-no-drag flex">
        <button onClick={() => window.electron?.window.minimize()}
          className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors text-sm">─</button>
        <button onClick={() => window.electron?.window.close()}
          className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-white hover:bg-red-600 transition-colors text-sm">✕</button>
      </div>
    </div>
  )

  // ── Pantalla "email enviado" ─────────────────────────────────────────────
  if (mode === 'sent') {
    return (
      <div className={`min-h-screen bg-slate-900 flex items-center justify-center p-4${IS_ELECTRON ? ' pt-14' : ''}`}>
        {ElectronTitleBar}
        <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">¡Revisa tu email!</h2>
          <p className="text-slate-400 mb-6">
            Te hemos enviado un enlace de confirmación a <strong className="text-slate-100">{email}</strong>.
            Haz clic en él para activar tu cuenta.
          </p>
          <p className="text-slate-500 text-sm mb-6">
            Si no lo ves, revisa la carpeta de spam.
          </p>
          <button
            onClick={() => setMode('login')}
            className="text-primary-400 hover:text-primary-300 underline text-sm"
          >
            Volver al inicio de sesión
          </button>
        </div>
      </div>
    )
  }

  // ── Pantalla "cuenta confirmada" ─────────────────────────────────────────
  if (mode === 'confirmed') {
    return (
      <div className={`min-h-screen bg-slate-900 flex items-center justify-center p-4${IS_ELECTRON ? ' pt-14' : ''}`}>
        {ElectronTitleBar}
        <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">¡Cuenta activada!</h2>
          <p className="text-slate-400 mb-6">Tu cuenta ha sido verificada correctamente. Ya puedes iniciar sesión.</p>
          <button
            onClick={() => setMode('login')}
            className="w-full bg-primary-600 hover:bg-primary-500 text-white font-semibold py-3 rounded-xl transition-all"
          >
            Iniciar sesión
          </button>
        </div>
      </div>
    )
  }

  // ── Formulario de Login / Registro ───────────────────────────────────────
  return (
    <div className={`min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4${IS_ELECTRON ? ' pt-14' : ''}`}>
      {ElectronTitleBar}

      {/* Descarga de apps — solo visible en web */}
      {IS_WEB && (
        <div className="w-full max-w-lg mb-4 space-y-3">
          {/* Apps móviles — juntas */}
          <div className="grid grid-cols-2 gap-3">
            {/* App móvil — Scan (fotos/grabar, la sencilla) */}
            <a
              href="https://github.com/Taylorete/studyai-releases/releases/download/v1.0.47/StudyAI-Android-1.0.47.apk"
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-primary-500 rounded-2xl px-3 py-3 transition-all group min-w-0"
            >
              <span className="text-2xl shrink-0">🔍</span>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-500 group-hover:text-slate-400 truncate">Android</p>
                <p className="text-sm font-semibold text-slate-100 truncate">MyStudy Scan</p>
              </div>
            </a>

            {/* App móvil completa — envoltorio TWA con toda la web */}
            <a
              href="https://github.com/Taylorete/studyai-releases/releases/download/v1.0.47/MyStudyApp-1.0.47.apk"
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-primary-500 rounded-2xl px-3 py-3 transition-all group min-w-0"
            >
              <span className="text-2xl shrink-0">🎓</span>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-500 group-hover:text-slate-400 truncate">Android</p>
                <p className="text-sm font-semibold text-slate-100 truncate">MyStudy App</p>
              </div>
            </a>
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl">

        {/* Logo y título */}
        <div className="text-center mb-8">
          <h1><Logo size="xl" className="justify-center" /></h1>
          <p className="text-slate-400 mt-2">Tu asistente de estudio</p>
        </div>

        {/* Registro cerrado SOLO en web: la fase beta es por invitacion y no
            interesa que alguien que llegue por casualidad a mystudyai.eu se
            cree una cuenta. En movil no aplica -- esas apps no son publicas,
            asi que ahi no hay nadie que pueda llegar de rebote. */}
        {IS_WEB && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <p className="text-sm font-semibold text-amber-300 mb-1">Beta cerrada</p>
            <p className="text-xs text-slate-300">
              MyStudy AI está en fase de pruebas y el registro está cerrado por ahora.
              Si ya tienes cuenta, inicia sesión abajo. ¿Te interesa participar?
              Escríbenos a{' '}
              <a href="mailto:support@mystudyai.eu" className="text-amber-300 underline">
                support@mystudyai.eu
              </a>.
            </p>
          </div>
        )}

        {/* Tabs Login / Registro */}
        <div className="flex rounded-xl bg-slate-700/50 p-1 mb-6">
          <button
            onClick={() => { setMode('login'); setError(null) }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'login'
                ? 'bg-primary-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Iniciar sesión
          </button>
          <button
            onClick={() => { setMode('register'); setError(null) }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'register'
                ? 'bg-primary-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Crear cuenta
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Nombre (solo en registro) */}
          {mode === 'register' && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Tu nombre"
                required
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary-500 transition"
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              autoComplete="email"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary-500 transition"
            />
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Contraseña</label>
            <PasswordInput
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary-500 transition"
            />
          </div>

          {/* Repetir contraseña (solo en registro) */}
          {mode === 'register' && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Repite la contraseña</label>
              <PasswordInput
                value={passwordConfirm}
                onChange={e => setPasswordConfirm(e.target.value)}
                placeholder="Repite la contraseña"
                required
                autoComplete="new-password"
                className={`w-full bg-slate-700 border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none transition ${
                  passwordConfirm && passwordConfirm !== password ? 'border-red-600 focus:border-red-500' : 'border-slate-600 focus:border-primary-500'
                }`}
              />
            </div>
          )}

          {/* Región fiscal (solo registro web, para aplicar IGIC o IVA en Stripe) */}
          {mode === 'register' && IS_WEB && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">¿Dónde resides?</label>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => chooseBillingRegion('resto')}
                  className={`py-2.5 rounded-xl text-xs font-medium border transition ${
                    billingRegion === 'resto' ? 'bg-primary-600 border-primary-600 text-white' : 'bg-slate-700 border-slate-600 text-slate-300'
                  }`}>Resto España / extranjero</button>
                <button type="button" onClick={() => chooseBillingRegion('canarias')}
                  className={`py-2.5 rounded-xl text-xs font-medium border transition ${
                    billingRegion === 'canarias' ? 'bg-primary-600 border-primary-600 text-white' : 'bg-slate-700 border-slate-600 text-slate-300'
                  }`}>Canarias</button>
                <button type="button" onClick={() => chooseBillingRegion('ceuta_melilla')}
                  className={`py-2.5 rounded-xl text-xs font-medium border transition ${
                    billingRegion === 'ceuta_melilla' ? 'bg-primary-600 border-primary-600 text-white' : 'bg-slate-700 border-slate-600 text-slate-300'
                  }`}>Ceuta / Melilla</button>
              </div>
              <p className="text-xs text-slate-500 mt-1">Se usa para aplicarte el impuesto correcto si compras el plan Pro o bonos.</p>
            </div>
          )}

          {/* Verificación anti-bot (Cloudflare Turnstile) — login y registro */}
          {turnstile.enabled && (
            <div ref={turnstile.containerRef} />
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Reset enviado */}
          {resetSent && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm">
              📧 Te hemos enviado un enlace para restablecer tu contraseña.
            </div>
          )}

          {/* Aceptar términos — solo en registro, sin marcar por defecto */}
          {mode === 'register' && (
            <label className="flex items-start gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={e => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 accent-primary-500"
              />
              <span>
                Acepto los{' '}
                <Link to="/terminos" target="_blank" className="text-primary-400 hover:text-primary-300 underline">Términos y Condiciones</Link>
                {' '}y la{' '}
                <Link to="/privacidad" target="_blank" className="text-primary-400 hover:text-primary-300 underline">Política de Privacidad</Link>
              </span>
            </label>
          )}

          {/* Botón enviar */}
          <button
            type="submit"
            disabled={loading || (turnstile.enabled && !turnstile.token) || (mode === 'register' && (!acceptedTerms || password !== passwordConfirm || (IS_WEB && !billingRegion)))}
            className="w-full bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg"
          >
            {loading ? '...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>

          {/* Olvidé mi contraseña — solo en login */}
          {mode === 'login' && (
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={loading}
              className="w-full text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}
        </form>

        {/* Separador */}
        <div className="flex items-center gap-3 my-5">
          <div className="h-px flex-1 bg-slate-700" />
          <span className="text-xs text-slate-500">o</span>
          <div className="h-px flex-1 bg-slate-700" />
        </div>

        {/* Iniciar con Google */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading || (mode === 'register' && !acceptedTerms)}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-800 font-semibold py-3 rounded-xl transition-all shadow-lg"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M23.52 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.73z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.9l-3.88-3c-1.08.72-2.45 1.15-4.05 1.15-3.11 0-5.75-2.1-6.69-4.92H1.3v3.09C3.26 21.3 7.31 24 12 24z"/>
            <path fill="#FBBC05" d="M5.31 14.33A7.2 7.2 0 0 1 4.93 12c0-.81.14-1.6.38-2.33V6.58H1.3A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.3 5.42l4.01-3.09z"/>
            <path fill="#EA4335" d="M12 4.75c1.76 0 3.35.61 4.6 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.3 6.58l4.01 3.09C6.25 6.85 8.89 4.75 12 4.75z"/>
          </svg>
          Continuar con Google
        </button>

        {/* En modo login, Google tambien puede dar de alta a alguien que no
            tenia cuenta -- ahi el checkbox no se muestra, asi que la aceptacion
            se informa aqui de forma expresa antes de pulsar. */}
        {mode === 'login' && (
          <p className="text-[11px] text-slate-500 text-center mt-2">
            Si continúas con Google y aún no tienes cuenta, aceptas los{' '}
            <Link to="/terminos" target="_blank" className="text-primary-400 hover:text-primary-300 underline">Términos y Condiciones</Link>
            {' '}y la{' '}
            <Link to="/privacidad" target="_blank" className="text-primary-400 hover:text-primary-300 underline">Política de Privacidad</Link>
          </p>
        )}

        <button
          type="button"
          onClick={() => navigate('/delete-account')}
          className="w-full text-slate-700 hover:text-slate-500 text-[11px] transition-colors mt-4"
        >
          ¿Quieres borrar tu cuenta?
        </button>

        <div className="flex items-center justify-center gap-4 text-[11px] text-slate-600 mt-3">
          <Link to="/terminos" target="_blank" className="hover:text-slate-400">Términos</Link>
          <Link to="/privacidad" target="_blank" className="hover:text-slate-400">Privacidad</Link>
          <Link to="/cookies" target="_blank" className="hover:text-slate-400">Cookies</Link>
        </div>

        <div className="flex items-center justify-center gap-4 mt-4">
          {SOCIAL_LINKS.map(({ Icon, href, label }) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer"
              className="text-slate-600 hover:text-primary-400 transition-colors" title={label} aria-label={label}>
              <Icon size={17} />
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
