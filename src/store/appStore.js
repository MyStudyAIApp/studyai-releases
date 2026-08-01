import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase, WEB_API } from '../lib/supabase'
import { pushSettings } from '../services/settingsSync'

// Detectar entorno de ejecución
export const IS_ELECTRON = typeof window !== 'undefined' && !!window.electronAPI
export const IS_MOBILE   = typeof window !== 'undefined' && !!(window.Capacitor?.isNativePlatform?.())
export const IS_WEB      = typeof window !== 'undefined' && !window.electronAPI && !window.Capacitor?.isNativePlatform?.()

// Hay dos apps Android distintas hechas con Capacitor (misma plataforma nativa,
// distinto paquete): "MyStudy Scan" (com.studyai.app, solo escanear/grabar) y
// "MyStudy App" (eu.mystudyai.twa, la app completa). IS_MOBILE por sí solo no
// las distingue -- esta función mira el ID de paquete real en tiempo de
// ejecución (rápido, es una llamada nativa local, sin red) para saber cuál es.
export const MYSTUDY_APP_FULL_ID = 'eu.mystudyai.twa'
export async function detectIsFullMobileApp() {
  if (!IS_MOBILE) return false
  try {
    const { App } = await import('@capacitor/app')
    const info = await App.getInfo()
    return info.id === MYSTUDY_APP_FULL_ID
  } catch {
    return false  // si falla la detección, por seguridad se trata como Scan (la versión reducida)
  }
}

// Plataforma actual, mandada en cada petición (cabecera X-Client-Platform) para
// que el backend pueda saber qué plataforma generó cada uso real — de cara a
// decidir con datos si merece la pena mantener el escritorio nativo.
const CLIENT_PLATFORM = IS_ELECTRON ? 'desktop' : IS_MOBILE ? 'mobile' : 'web'

// Idioma de respuesta de la IA por defecto: detecta el idioma del navegador/sistema
// (mismo criterio que ya usa i18next para la interfaz) entre los soportados;
// si no coincide con ninguno, cae a español. El usuario siempre puede cambiarlo
// después en Ajustes — esto solo afecta al valor inicial en el primer uso.
const RESPONSE_LANG_CODES = ['es', 'en', 'de', 'fr']
function detectDefaultResponseLang() {
  if (typeof navigator === 'undefined') return 'es'
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const raw of candidates) {
    const code = (raw || '').slice(0, 2).toLowerCase()
    if (RESPONSE_LANG_CODES.includes(code)) return code
  }
  return 'es'
}

// URL del backend Python según el modo:
//   - Escritorio (Electron): puerto 8765 (main.py local)
//   - Móvil / Web:           web_main.py en la nube (o PC local en desarrollo)
const API_BASE = IS_ELECTRON ? 'http://127.0.0.1:8765' : WEB_API

// Token secreto local (ver electron/main.js) — el backend de escritorio lo
// exige en toda petición para que una página web ajena no pueda llamar a
// http://127.0.0.1:8765 aprovechando la sesión ya iniciada. Se pide una sola
// vez por IPC (no cambia durante la vida del proceso) y se cachea.
let _localAuthTokenPromise = null
export async function getLocalAuthHeader() {
  if (!IS_ELECTRON) return {}
  if (!_localAuthTokenPromise) _localAuthTokenPromise = window.electron.app.getLocalToken()
  const token = await _localAuthTokenPromise
  return token ? { 'X-Local-Auth': token } : {}
}

// Obtener la cabecera de autenticación con el token JWT del usuario logueado.
// También en escritorio: el backend local (main.py) la reenvía al backend de
// la nube para generar con IA, así el uso se cuenta igual en las 3 plataformas.
export async function getAuthHeader(forceRefresh = false) {
  try {
    let { data: { session } } = await supabase.auth.getSession()
    if (!session) return {}

    // Si el token expira en menos de 2 minutos (o ya expiró), forzar refresco.
    // En móvil el scanner de ML Kit abre una Activity separada y el WebView
    // queda en background, impidiendo el auto-refresh de Supabase.
    // forceRefresh=true fuerza el refresco aunque el token todavía sea
    // válido -- lo usan los reintentos tras un 401, por si el corte fue
    // un bache de red puntual y no una sesión realmente caducada.
    const expiresAt = (session.expires_at ?? 0) * 1000
    if (forceRefresh || Date.now() > expiresAt - 120_000) {
      const { data: refreshed } = await supabase.auth.refreshSession()
      if (refreshed?.session) session = refreshed.session
      else return {}
    }

    if (!session.access_token) return {}
    return { Authorization: `Bearer ${session.access_token}` }
  } catch {
    return {}
  }
}

export const useAppStore = create(
  persist(
    (set, get) => ({
      // ── Backend ──────────────────────────────────────────────────────────
      apiBase: API_BASE,
      backendReady: false,
      backendError: null,
      setBackendReady: (v) => set({ backendReady: v }),
      setBackendError: (e) => set({ backendError: e }),

      // ── Toast notifications ───────────────────────────────────────────────
      toasts: [],
      addToast: (message, type = 'info', duration = 4000) => {
        const id = Date.now()
        set(s => ({ toasts: [...s.toasts, { id, message, type }] }))
        setTimeout(() => get().removeToast(id), duration)
      },
      removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

      // ── Plan real del usuario (incluye plan_override='pro' manual, que el
      //    cálculo local de src/lib/plan.js no puede conocer sin preguntar al
      //    backend) ──────────────────────────────────────────────────────────
      planTier: null,   // null hasta que se cargue; 'trial' | 'free' | 'pro'
      setPlanTier: (t) => set({ planTier: t }),

      // ── Aviso de cupo agotado (plan Free) ───────────────────────────────────
      quotaExceeded: null,   // { message, category } | null
      openQuotaExceeded: (message, category) => set({ quotaExceeded: { message, category } }),
      closeQuotaExceeded: () => set({ quotaExceeded: null }),

      // ── TTS settings ──────────────────────────────────────────────────────
      // Estos 6 campos (+ tema/idioma de interfaz/horas semanales, gestionados
      // aparte) se sincronizan con la nube — ver src/services/settingsSync.js.
      // _applyingRemote evita que aplicar lo que acaba de llegar de la nube
      // dispare a su vez un push de vuelta (bucle inútil, aunque inofensivo).
      ttsVoicesPerLang: {
        es: 'es-ES-ElviraNeural',
        en: 'en-US-EmmaNeural',
        fr: 'fr-FR-DeniseNeural',
      },
      ttsRate: '+10%',
      tutorTtsRate: '+25%',
      langsTtsRate: '+12%',
      setTtsVoiceForLang: (lang, voice) => {
        set(s => ({ ttsVoicesPerLang: { ...s.ttsVoicesPerLang, [lang]: voice } }))
        if (!get()._applyingRemote) pushSettings({ ttsVoicesPerLang: get().ttsVoicesPerLang })
      },
      setTtsRate: (r) => { set({ ttsRate: r }); if (!get()._applyingRemote) pushSettings({ ttsRate: r }) },
      setTutorTtsRate: (r) => { set({ tutorTtsRate: r }); if (!get()._applyingRemote) pushSettings({ tutorTtsRate: r }) },
      setLangsTtsRate: (r) => { set({ langsTtsRate: r }); if (!get()._applyingRemote) pushSettings({ langsTtsRate: r }) },

      // ── Study session stats ───────────────────────────────────────────────
      todayStudyMinutes: 0,
      addStudyMinutes: (m) => set(s => ({ todayStudyMinutes: s.todayStudyMinutes + m })),
      setTodayStudyMinutes: (m) => set({ todayStudyMinutes: m }),
      dailyGoalMinutes: 20,
      setDailyGoalMinutes: (m) => {
        set({ dailyGoalMinutes: m })
        if (!get()._applyingRemote) pushSettings({ dailyGoalMinutes: m })
      },

      // ── Idioma de respuesta de la IA (resúmenes, fichas, exámenes... — NO la
      //    sección Idiomas, que ya elige su propio idioma) ─────────────────
      responseLang: detectDefaultResponseLang(),
      setResponseLang: (l) => {
        set({ responseLang: l })
        if (!get()._applyingRemote) pushSettings({ responseLang: l })
      },

      // ── Aplicar ajustes sincronizados venidos de la nube (al iniciar sesión) ──
      _applyingRemote: false,
      applySyncedSettings: (s) => {
        set({ _applyingRemote: true })
        if (s.ttsVoicesPerLang) set(prev => ({ ttsVoicesPerLang: { ...prev.ttsVoicesPerLang, ...s.ttsVoicesPerLang } }))
        if (s.ttsRate)          set({ ttsRate: s.ttsRate })
        if (s.tutorTtsRate)     set({ tutorTtsRate: s.tutorTtsRate })
        if (s.langsTtsRate)     set({ langsTtsRate: s.langsTtsRate })
        if (s.dailyGoalMinutes != null) set({ dailyGoalMinutes: s.dailyGoalMinutes })
        if (s.responseLang)     set({ responseLang: s.responseLang })
        set({ _applyingRemote: false })
      },
    }),
    {
      name: 'studyai-store',
      partialize: (s) => ({ ttsVoicesPerLang: s.ttsVoicesPerLang, ttsRate: s.ttsRate, tutorTtsRate: s.tutorTtsRate, langsTtsRate: s.langsTtsRate, dailyGoalMinutes: s.dailyGoalMinutes, responseLang: s.responseLang }),
    }
  )
)

// ── API helpers ───────────────────────────────────────────────────────────────
// Todas las funciones de llamada al backend pasan por aquí.
// En modo web añaden automáticamente el token JWT en la cabecera Authorization.

// Cuando el backend devuelve 401, la sesión fue invalidada server-side aunque
// el JWT local parezca válido. Limpiar sesión → onAuthStateChange dispara
// SIGNED_OUT → ProtectedRoute redirige a /login automáticamente (sin aviso:
// si varias llamadas fallan a la vez se apilarían varios toasts iguales).
export function handleUnauthorized() {
  if (IS_ELECTRON) return
  supabase.auth.signOut().catch(() => {})
}

// Si el backend responde 403 con quota_exceeded=true (cupo del plan Free
// agotado), abre el aviso global en vez de dejar que cada pantalla muestre
// su propio toast genérico. Devuelve el Error para lanzarlo (con .quotaExceeded
// marcado, para que los catch de cada pantalla puedan evitar duplicar el aviso).
function _errorFromResponse(err, status) {
  if (status === 403 && err.quota_exceeded) {
    useAppStore.getState().openQuotaExceeded(err.detail, err.category)
    const e = new Error(err.detail)
    e.quotaExceeded = true
    return e
  }
  return new Error(err.detail || `HTTP ${status}`)
}

export async function api(method, path, body = null, signal = null) {
  const authHeader = await getAuthHeader()
  const localHeader = await getLocalAuthHeader()
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Client-Platform': CLIENT_PLATFORM, ...authHeader, ...localHeader },
    signal,
  }
  if (body) opts.body = JSON.stringify(body)
  const url = `${API_BASE}${path}`
  let res
  try {
    res = await fetch(url, opts)
  } catch (netErr) {
    throw new Error(`Sin conexión con el servidor (${new URL(url).hostname}) — ${netErr.message}`)
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    if (res.status === 401) handleUnauthorized()
    throw _errorFromResponse(err, res.status)
  }
  return res.json()
}

// Tope de espera de una subida. Sin esto, si el servidor se queda atascado
// el usuario ve "Guardando..." para siempre, sin error ni forma de saber que
// ha fallado (paso de verdad con los escaneos: el movil esperaba indefinidamente).
const UPLOAD_TIMEOUT_MS = 120_000

export async function apiUpload(path, formData, signal = null) {
  const authHeader = await getAuthHeader()
  const localHeader = await getLocalAuthHeader()
  const url = `${API_BASE}${path}`
  let res
  const ctrl = new AbortController()
  const porTiempo = setTimeout(() => ctrl.abort(), UPLOAD_TIMEOUT_MS)
  // Respeta también el signal que venga de fuera (p. ej. cancelar a mano)
  if (signal) signal.addEventListener('abort', () => ctrl.abort(), { once: true })
  try {
    // No poner Content-Type aquí — el navegador lo añade solo con el boundary del FormData
    res = await fetch(url, {
      method: 'POST',
      headers: { 'X-Client-Platform': CLIENT_PLATFORM, ...authHeader, ...localHeader },
      body: formData,
      signal: ctrl.signal,
    })
  } catch (netErr) {
    if (netErr?.name === 'AbortError' && !signal?.aborted) {
      throw new Error('El servidor ha tardado demasiado en responder. Vuelve a intentarlo en un momento.')
    }
    throw new Error(`Sin conexión con el servidor (${new URL(url).hostname}) — ${netErr.message}`)
  } finally {
    clearTimeout(porTiempo)
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    if (res.status === 401) handleUnauthorized()
    throw _errorFromResponse(err, res.status)
  }
  return res.json()
}

export async function apiStream(path, body, onChunk, signal = null) {
  const authHeader = await getAuthHeader()
  const localHeader = await getLocalAuthHeader()
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client-Platform': CLIENT_PLATFORM, ...authHeader, ...localHeader },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    if (res.status === 401) handleUnauthorized()
    throw _errorFromResponse(err, res.status)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        let parsed
        try { parsed = JSON.parse(line.slice(6)) } catch { continue }
        if (parsed.error) throw new Error(parsed.error)
        onChunk(parsed)
      }
    }
  }
}
