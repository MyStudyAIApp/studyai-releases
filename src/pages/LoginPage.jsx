/**
 * MyStudy AI — Página de Login y Registro
 * ======================================
 * Pantalla que ve el usuario cuando no está logueado.
 * Tiene dos modos: "iniciar sesión" y "crear cuenta".
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import { supabase, WEB_API } from '../lib/supabase'
import { marcarRecuperacionPendiente, errorDeEnlace, URL_DE_ENTRADA } from '../lib/recoveryWeb'
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

// Requisitos de contrasena, comprobados ANTES de llamar a Supabase: asi el
// usuario ve el motivo en su idioma en vez del error en ingles del servidor.
// El freno de verdad es el del panel de Supabase (nadie lo salta llamando a la
// API); esto es la capa amable de encima, y debe ir igual o mas estricta.
export const PASSWORD_MIN = 8

export function passwordProblem(pw) {
  if (pw.length < PASSWORD_MIN) return 'length'
  if (!/[a-zà-ÿ]/.test(pw)) return 'lower'
  if (!/[A-ZÀ-Þ]/.test(pw)) return 'upper'
  if (!/[0-9]/.test(pw)) return 'digit'
  // Cualquier cosa que no sea letra ni numero cuenta como simbolo, incluido el
  // espacio: no vale enumerar una lista y dejar fuera los teclados de otros
  // idiomas.
  if (!/[^a-zA-ZÀ-ÿ0-9]/.test(pw)) return 'symbol'
  return null
}

export default function LoginPage() {
  const { t } = useTranslation()
  const { user, beginPasswordRecovery } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // En cuanto el login tiene éxito, user pasa de null a tener valor → ir al
  // destino de donde venía (ej. /admin si el candado de MyStudy Admin está
  // activo, o de donde ProtectedRoute redirigió) -- si no hay ninguno, /home.
  useEffect(() => {
    if (!user) return
    const isAdminLockedApp = sessionStorage.getItem('studyai_admin_lock') === '1'
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
    // Bajo HashRouter el hash ES la ruta ("#/login", "#/terminos"...). Un
    // callback de Supabase llega siempre como "#access_token=...", "#error=..."
    // o similar, nunca empezando por "#/". Sin esta comprobacion, el
    // replaceState del final borraba la ruta actual y devolvia al usuario a la
    // portada: era imposible abrir Condiciones/Privacidad/Cookies.
    // Con PKCE el error NO viene en el hash sino en la query (?error=...), asi
    // que se mira la URL de entrada entera. Sin esto, un enlace ya usado o
    // caducado dejaba al usuario en el login sin ninguna explicacion.
    const fallo = errorDeEnlace(URL_DE_ENTRADA)
    if (fallo) {
      setError(fallo === 'caducado' ? t('auth.err.recoveryExpired') : t('auth.err.linkInvalid'))
      window.history.replaceState(null, '', window.location.pathname)
      return
    }
    if (!hash || hash.startsWith('#/')) return
    const params = new URLSearchParams(hash.slice(1))
    const errorCode = params.get('error_code')
    const type = params.get('type')
    if (errorCode === 'otp_expired' || errorCode === 'otp_disabled') {
      setError(t('auth.err.linkExpired'))
    } else if (params.get('error')) {
      setError(t('auth.err.linkInvalid'))
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
          ? t('auth.err.recoveryExpired')
          : t('auth.err.googleFailed'))
        else if (isRecovery) beginPasswordRecovery()
      } catch {
        setError(t('auth.err.generic'))
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
          ? t('auth.err.recoveryExpired')
          : t('auth.err.googleFailed'))
      } catch {
        setError(t('auth.err.generic'))
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
      setError(t('auth.err.mustAccept'))
      return
    }
    if (IS_WEB) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) setError(t('auth.err.googleFailed'))
      return
    }
    try {
      const url = await getGoogleOAuthUrl()
      if (IS_MOBILE) await Browser.open({ url })
      else await window.electron.shell.openExternal(url)
    } catch {
      setError(t('auth.err.googleFailed'))
    }
  }

  const handleForgotPassword = async () => {
    if (!email) { setError(t('auth.err.emailFirst')); return }
    if (turnstile.enabled && !turnstile.token) {
      setError(t('auth.err.captcha'))
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
        // La vuelta del enlace se detecta con esta marca, no con el evento
        // PASSWORD_RECOVERY: se dispara antes de que AuthContext escuche.
        marcarRecuperacionPendiente()
      } else {
        // Escritorio y móvil: el enlace debe volver A LA APP, no a la web. Con
        // PKCE el código solo se canjea donde se guardó el verificador; si abre
        // el navegador, falla en silencio y el usuario acaba en la landing sin
        // poder cambiar nada (ver src/lib/googleAuth.js).
        await startNativePasswordRecovery(email, turnstile.token)
      }
      setResetSent(true)
    } catch {
      setError(t('auth.err.emailSend'))
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
          setError(t('auth.err.captcha'))
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
        const problema = passwordProblem(password)
        if (problema) {
          setError(t(`auth.err.pw${problema[0].toUpperCase()}${problema.slice(1)}`, { min: PASSWORD_MIN }))
          setLoading(false)
          return
        }
        if (password !== passwordConfirm) {
          setError(t('auth.err.noMatch'))
          setLoading(false)
          return
        }
        if (!acceptedTerms) {
          setError(t('auth.err.mustAccept'))
          setLoading(false)
          return
        }
        if (turnstile.enabled && !turnstile.token) {
          setError(t('auth.err.captcha'))
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
        setError(t('auth.err.badCredentials'))
      else if (msg.includes('Email not confirmed'))
        setError(t('auth.err.confirmFirst'))
      else if (msg.includes('User already registered'))
        setError(t('auth.err.already'))
      else if (msg.includes('Password should be at least'))
        setError(t('auth.err.tooShort', { min: PASSWORD_MIN }))
      // El registro se cierra en Supabase (Authentication -> "Allow new users
      // to sign up"), no en la interfaz: ocultar el formulario no impedia nada,
      // y de hecho por el boton de Google se colaron dos cuentas. Cuando esta
      // cerrado, Supabase responde con estos mensajes: hay que traducirlos a
      // algo que el usuario entienda.
      else if (msg.includes('Signups not allowed') || msg.includes('signup is disabled') || msg.includes('Sign ups not allowed'))
        setError(t('auth.err.betaClosed'))
      // El cierre de la beta vive en la base de datos (trigger
      // comprobar_invitacion_beta sobre auth.users, con la lista
      // public.beta_invitados). Cuando rechaza, Supabase devuelve este mensaje
      // generico, asi que hay que traducirlo aqui.
      else if (msg.includes('Database error saving new user'))
        setError(t('auth.err.betaClosed'))
      else
        setError(msg || t('auth.err.unknown'))
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
          <h2 className="text-2xl font-bold text-slate-100 mb-2">{t('auth.checkEmailTitle')}</h2>
          <p className="text-slate-400 mb-6">
            <Trans i18nKey="auth.checkEmailBody" values={{ email }}
                   components={[<strong className="text-slate-100" key="e" />]} />
          </p>
          <p className="text-slate-500 text-sm mb-6">
            {t('auth.spamNote')}
          </p>
          <button
            onClick={() => setMode('login')}
            className="text-primary-400 hover:text-primary-300 underline text-sm"
          >
            {t('auth.backToLogin')}
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
          <h2 className="text-2xl font-bold text-slate-100 mb-2">{t('auth.activatedTitle')}</h2>
          <p className="text-slate-400 mb-6">{t('auth.activatedBody')}</p>
          <button
            onClick={() => setMode('login')}
            className="w-full bg-primary-600 hover:bg-primary-500 text-white font-semibold py-3 rounded-xl transition-all"
          >
            {t('auth.signIn')}
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
              href="https://play.google.com/store/apps/details?id=eu.mystudyai.scan"
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
              href="https://play.google.com/store/apps/details?id=eu.mystudyai.twa"
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
          <p className="text-slate-400 mt-2">{t('auth.tagline')}</p>
        </div>

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
            {t('auth.signIn')}
          </button>
          <button
            onClick={() => { setMode('register'); setError(null) }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'register'
                ? 'bg-primary-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            {t('auth.createAccount')}
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Nombre (solo en registro) */}
          {mode === 'register' && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t('auth.name')}</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('auth.namePlaceholder')}
                required
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary-500 transition"
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              required
              autoComplete="email"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary-500 transition"
            />
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">{t('auth.password')}</label>
            <PasswordInput
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'register' ? t('auth.passwordHint', { min: PASSWORD_MIN }) : '••••••••'}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary-500 transition"
            />
          </div>

          {/* Repetir contraseña (solo en registro) */}
          {mode === 'register' && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t('auth.passwordRepeat')}</label>
              <PasswordInput
                value={passwordConfirm}
                onChange={e => setPasswordConfirm(e.target.value)}
                placeholder={t('auth.passwordRepeat')}
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
              <label className="block text-sm text-slate-400 mb-1">{t('auth.residence')}</label>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => chooseBillingRegion('resto')}
                  className={`py-2.5 rounded-xl text-xs font-medium border transition ${
                    billingRegion === 'resto' ? 'bg-primary-600 border-primary-600 text-white' : 'bg-slate-700 border-slate-600 text-slate-300'
                  }`}>{t('auth.residenceRest')}</button>
                <button type="button" onClick={() => chooseBillingRegion('canarias')}
                  className={`py-2.5 rounded-xl text-xs font-medium border transition ${
                    billingRegion === 'canarias' ? 'bg-primary-600 border-primary-600 text-white' : 'bg-slate-700 border-slate-600 text-slate-300'
                  }`}>{t('auth.residenceCanarias')}</button>
                <button type="button" onClick={() => chooseBillingRegion('ceuta_melilla')}
                  className={`py-2.5 rounded-xl text-xs font-medium border transition ${
                    billingRegion === 'ceuta_melilla' ? 'bg-primary-600 border-primary-600 text-white' : 'bg-slate-700 border-slate-600 text-slate-300'
                  }`}>{t('auth.residenceCeuta')}</button>
              </div>
              <p className="text-xs text-slate-500 mt-1">{t('auth.residenceHelp')}</p>
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
              📧 {t('auth.resetSent')}
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
                {t('auth.accept')}{' '}
                <Link to="/terminos" className="text-primary-400 hover:text-primary-300 underline">{t('auth.terms')}</Link>
                {' '}{t('auth.and')}{' '}
                <Link to="/privacidad" className="text-primary-400 hover:text-primary-300 underline">{t('auth.privacy')}</Link>
                {t('auth.ageConfirm')}
              </span>
            </label>
          )}

          {/* Botón enviar */}
          <button
            type="submit"
            disabled={loading || (turnstile.enabled && !turnstile.token) || (mode === 'register' && (!acceptedTerms || password !== passwordConfirm || (IS_WEB && !billingRegion)))}
            className="w-full bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg"
          >
            {loading ? '...' : mode === 'login' ? t('auth.enter') : t('auth.createAccount')}
          </button>

          {/* Olvidé mi contraseña — solo en login */}
          {mode === 'login' && (
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={loading}
              className="w-full text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              {t('auth.forgot')}
            </button>
          )}
        </form>

        {/* Separador */}
        <div className="flex items-center gap-3 my-5">
          <div className="h-px flex-1 bg-slate-700" />
          <span className="text-xs text-slate-500">{t('auth.or')}</span>
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
          {t('auth.googleContinue')}
        </button>

        {/* En modo login, Google tambien puede dar de alta a alguien que no
            tenia cuenta -- ahi el checkbox no se muestra, asi que la aceptacion
            se informa aqui de forma expresa antes de pulsar. */}
        {mode === 'login' && (
          <p className="text-[11px] text-slate-500 text-center mt-2">
            {t('auth.googleNotice')}{' '}
            <Link to="/terminos" className="text-primary-400 hover:text-primary-300 underline">{t('auth.terms')}</Link>
            {' '}{t('auth.and')}{' '}
            <Link to="/privacidad" className="text-primary-400 hover:text-primary-300 underline">{t('auth.privacy')}</Link>
            {t('auth.googleAgeConfirm')}
          </p>
        )}

        <button
          type="button"
          onClick={() => navigate('/delete-account')}
          className="w-full text-slate-700 hover:text-slate-500 text-[11px] transition-colors mt-4"
        >
          {t('auth.deleteAccount')}
        </button>

        <div className="flex items-center justify-center gap-4 text-[11px] text-slate-600 mt-3">
          <Link to="/terminos" className="hover:text-slate-400">{t('auth.terms')}</Link>
          <Link to="/privacidad" className="hover:text-slate-400">Privacidad</Link>
          <Link to="/cookies" className="hover:text-slate-400">Cookies</Link>
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
