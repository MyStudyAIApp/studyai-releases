import { useState, useEffect, useRef } from 'react'
import { useAppStore, api, IS_WEB, IS_ELECTRON, getAuthHeader, getLocalAuthHeader } from '../store/appStore'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGS } from '../i18n'

// Idiomas disponibles para el CONTENIDO generado por la IA (resúmenes, fichas,
// exámenes...) — independiente del idioma de la interfaz (arriba). Se amplía
// el día que se traduzca la interfaz a más idiomas.
const RESPONSE_LANGS = [
  { code: 'es', label: 'Español',  flag: '🇪🇸' },
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch',  flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
]
import { useAuth } from '../contexts/AuthContext'
import PasswordInput from '../components/UI/PasswordInput'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase, WEB_API } from '../lib/supabase'
import WhisperSetup from '../components/WhisperSetup'
import WeeklyHoursWidget, { loadWeeklyHours, saveWeeklyHours } from '../components/Study/WeeklyHoursWidget'
import FeedbackModal from '../components/UI/FeedbackModal'
import Modal from '../components/UI/Modal'
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed, isPushSupported } from '../services/pushNotifications'
import { THEMES, getTheme, applyTheme } from '../services/themeService'
import { pushSettings } from '../services/settingsSync'
import {
  IconHome, IconBooks, IconBrain, IconFileText, IconWorld, IconMicrophone2,
  IconCalculator, IconScale, IconChartBar, IconCalendar, IconSettings,
} from '@tabler/icons-react'
import IconBadge from '../components/UI/IconBadge'

// Mismo icono/color que en la barra lateral (Sidebar.jsx) para cada sección —
// si cambian los iconos de la app, hay que actualizar este mapa también.
const TUTORIAL_SECTION_ICONS = {
  home:      { Icon: IconHome,        color: 'blue'   },
  library:   { Icon: IconBooks,       color: 'purple' },
  study:     { Icon: IconBrain,       color: 'green'  },
  exam:      { Icon: IconFileText,    color: 'amber'  },
  tutor:     { emoji: '🦉',           color: 'purple' },
  languages: { Icon: IconWorld,       color: 'teal'   },
  lecture:   { Icon: IconMicrophone2, color: 'pink'   },
  solve:     { Icon: IconCalculator,  color: 'blue'   },
  compare:   { Icon: IconScale,       color: 'purple' },
  stats:     { Icon: IconChartBar,    color: 'green'  },
  calendar:  { Icon: IconCalendar,    color: 'amber'  },
  settings:  { Icon: IconSettings,    color: 'slate'  },
}

// ollamaRecommended se carga dinámicamente desde el backend (que a su vez
// lo obtiene de GitHub o usa la lista embebida). Ver loadOllamaStatus().

// ── Voces disponibles agrupadas por idioma ────────────────────────────────
const TTS_LANG_GROUPS = [
  {
    lang: 'es',
    flag: '🇪🇸',
    label: 'Español',
    voices: [
      { value: 'es-ES-ElviraNeural', label: 'Elvira · Mujer'  },
      { value: 'es-ES-AlvaroNeural', label: 'Álvaro · Hombre' },
    ],
  },
  {
    lang: 'en',
    flag: '🇬🇧',
    label: 'English',
    voices: [
      { value: 'en-GB-SoniaNeural', label: 'Sonia · UK · Female' },
      { value: 'en-GB-RyanNeural',  label: 'Ryan · UK · Male'    },
      { value: 'en-US-EmmaNeural',  label: 'Emma · US · Female'  },
      { value: 'en-US-BrianNeural', label: 'Brian · US · Male'   },
    ],
  },
  {
    lang: 'fr',
    flag: '🇫🇷',
    label: 'Français',
    voices: [
      { value: 'fr-FR-DeniseNeural', label: 'Denise · Femme' },
      { value: 'fr-FR-HenriNeural',  label: 'Henri · Homme'  },
    ],
  },
]

// ── Orden de las secciones en "Tutoriales" (mismo orden que la barra lateral) ──
const TUTORIAL_SECTION_KEYS = [
  'home', 'library', 'study', 'exam', 'tutor', 'languages',
  'lecture', 'solve', 'compare', 'stats', 'calendar', 'settings',
]

const TTS_RATES = [
  { value: '-20%', label: '🐢 Lento'            },
  { value: '+0%',  label: '▶ Normal'            },
  { value: '+10%', label: '⚡ Rápido (defecto)'  },
  { value: '+25%', label: '🚀 Muy rápido'       },
  { value: '+40%', label: '💨 Ultra rápido'     },
]

// ── Comprobador de actualizaciones (inline en Ajustes) ───────────────────────
function UpdateChecker() {
  // idle | checking | up-to-date | available | error
  const [state, setState]   = useState('idle')
  const [version, setVersion] = useState(null)
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    const api = window.electron?.updater
    if (!api) return
    // Si llega una actualización mientras el usuario está en Ajustes, reflejarla aquí
    const unsubAvail = api.onAvailable((info) => {
      setVersion(info.version)
      setState('available')
    })
    const unsubNot = api.onNotAvailable?.(() => {
      setState(s => s === 'checking' ? 'up-to-date' : s)
    })
    return () => { unsubAvail?.(); unsubNot?.() }
  }, [])

  const handleCheck = async () => {
    setState('checking')
    setErrMsg('')
    setVersion(null)
    const api = window.electron?.updater
    if (!api?.check) {
      // En desarrollo no hay updater — simulamos
      setTimeout(() => setState('up-to-date'), 800)
      return
    }
    const res = await api.check()
    if (res.error) {
      setErrMsg(res.error)
      setState('error')
    }
    // El resultado llega por los eventos onAvailable / onNotAvailable (ver useEffect arriba)
  }

  return (
    <div className="mt-3 mb-1">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleCheck}
          disabled={state === 'checking'}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-600 bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state === 'checking'
            ? <><span className="animate-spin">⟳</span> Buscando...</>
            : <><span>🔄</span> Buscar actualizaciones</>}
        </button>

        {state === 'up-to-date' && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            ✅ La app está al día
          </span>
        )}

        {state === 'available' && (
          <span className="text-xs text-blue-400 flex items-center gap-1">
            🆕 {version ? `Versión ${version} disponible` : 'Nueva versión disponible'} — mira la notificación abajo a la derecha
          </span>
        )}

        {state === 'error' && (
          <span className="text-xs text-red-400">
            ⚠️ Error al comprobar: {errMsg}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Tarjeta de gestión de Whisper ─────────────────────────────────────────
function WhisperCard() {
  const [status, setStatus]         = useState('checking')  // checking | installed | missing
  const [showDownloader, setShowDownloader] = useState(false)

  // Comprobar si el modelo está instalado al montar
  useEffect(() => {
    window.electron?.whisper?.check()
      .then(({ installed }) => setStatus(installed ? 'installed' : 'missing'))
      .catch(() => setStatus('missing'))
  }, [])

  // Cuando la descarga termine, actualizar el estado
  const handleDismiss = () => {
    setShowDownloader(false)
    // Re-comprobar por si acaso se instaló durante la sesión
    window.electron?.whisper?.check()
      .then(({ installed }) => setStatus(installed ? 'installed' : 'missing'))
      .catch(() => {})
  }

  return (
    <CollapsibleCard
      icon="🎤"
      title="Reconocimiento de voz (Whisper)"
      subtitle={
        status === 'checking' ? 'Comprobando...' :
        status === 'installed' ? 'Instalado y listo' :
        'No instalado'
      }
      defaultOpen={status === 'missing'}
    >
      {/* Explicación siempre visible */}
      <div className="bg-slate-700/40 rounded-xl p-4 mb-4 border border-slate-600/40">
        <p className="text-sm text-slate-200 leading-relaxed mb-2">
          <strong className="text-slate-100">Whisper</strong> es el motor que convierte tu
          voz en texto. Funciona 100% offline — tu audio nunca sale de tu ordenador.
        </p>
        <ul className="text-sm text-slate-300 space-y-1 ml-2">
          <li>🎙️ Dictar apuntes · 📹 Transcribir vídeos · 🗣️ Tutor por voz</li>
        </ul>
        <p className="text-xs text-amber-300 mt-3 font-medium">
          ⚠️ Es fundamental tenerlo instalado para el correcto funcionamiento de todas
          las funciones de voz y transcripción.
        </p>
      </div>

      {/* Estado: comprobando */}
      {status === 'checking' && (
        <p className="text-sm text-slate-400 animate-pulse">Comprobando estado...</p>
      )}

      {/* Estado: instalado */}
      {status === 'installed' && !showDownloader && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 bg-emerald-900/30 border border-emerald-700/40 rounded-xl px-4 py-3">
            <span className="text-xl">✅</span>
            <div>
              <p className="text-sm font-semibold text-emerald-300">Whisper instalado correctamente</p>
              <p className="text-xs text-emerald-400/70">Todas las funciones de voz están disponibles</p>
            </div>
          </div>
          <button
            onClick={() => setShowDownloader(true)}
            className="text-xs text-slate-500 hover:text-slate-300 px-3 py-2 rounded-lg hover:bg-slate-700 transition-colors whitespace-nowrap"
          >
            Reinstalar
          </button>
        </div>
      )}

      {/* Estado: no instalado o reinstalando */}
      {(status === 'missing' || showDownloader) && (
        <WhisperSetup embedded onDismiss={handleDismiss} />
      )}
    </CollapsibleCard>
  )
}

// ── Tarjeta de gestión del CUDA pack (aceleración GPU para Whisper) ───────
// Mismo patrón de transparencia que WhisperCard: el usuario decide si lo
// instala, ve el progreso real, puede cancelar, y puede desinstalarlo cuando
// quiera. Es puramente opcional -- sin él, la transcripción sigue funcionando
// igual de bien, solo que en CPU en vez de GPU.
function CudaCard() {
  // checking | no-gpu | missing | downloading | extracting | installed | error
  const [state, setState]       = useState('checking')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  const refresh = () => {
    const api = window.electron?.cuda
    if (!api) return
    api.hasNvidiaGpu().then(({ hasGpu }) => {
      if (!hasGpu) { setState('no-gpu'); return }
      api.check().then(({ installed }) => setState(installed ? 'installed' : 'missing'))
    }).catch(() => setState('no-gpu'))
  }

  useEffect(() => { refresh() }, [])

  useEffect(() => {
    const api = window.electron?.cuda
    if (!api) return
    const unsubProgress = api.onProgress((pct) => { setProgress(pct); setState('downloading') })
    const unsubExtracting = api.onExtracting(() => setState('extracting'))
    const unsubDone = api.onDone(() => { setProgress(100); setState('installed') })
    const unsubError = api.onError((msg) => {
      if (msg === 'cancelled') { setState('missing') }
      else { setErrorMsg(msg); setState('error') }
    })
    return () => { unsubProgress?.(); unsubExtracting?.(); unsubDone?.(); unsubError?.() }
  }, [])

  if (state === 'checking' || state === 'no-gpu') return null  // sin GPU compatible, no hay nada que ofrecer

  const handleDownload = () => {
    setState('downloading'); setProgress(0); setErrorMsg('')
    window.electron?.cuda?.download()
  }
  const handleCancel = () => window.electron?.cuda?.cancel()
  const handleUninstall = async () => {
    const r = await window.electron?.cuda?.uninstall()
    if (r?.ok) setState('missing')
    else addToastFallback('No se pudo desinstalar porque está en uso — cierra y vuelve a abrir MyStudy AI, luego inténtalo de nuevo.')
  }
  // pequeño aviso inline en vez de importar el store solo para esto
  function addToastFallback(msg) { setErrorMsg(msg); setState('error') }

  return (
    <CollapsibleCard
      icon="⚡"
      title="Aceleración por GPU (CUDA)"
      subtitle={
        state === 'installed' ? 'Instalada' :
        state === 'missing' ? 'Disponible para tu GPU' :
        state === 'downloading' ? `Descargando… ${progress}%` :
        state === 'extracting' ? 'Instalando…' : 'Error'
      }
      defaultOpen={false}
    >
      <div className="bg-slate-700/40 rounded-xl p-4 mb-4 border border-slate-600/40">
        <p className="text-sm text-slate-200 leading-relaxed mb-2">
          Hemos detectado una <strong className="text-slate-100">GPU NVIDIA compatible</strong> en
          tu ordenador. Instalando este paquete, la transcripción de voz con Whisper es
          bastante más rápida que en CPU.
        </p>
        <p className="text-xs text-slate-400">
          Totalmente opcional — sin él, la transcripción sigue funcionando igual de bien, solo que más lenta.
        </p>
      </div>

      {state === 'missing' && (
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleDownload}
            className="flex-1 min-w-[160px] bg-primary-600 hover:bg-primary-500 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm"
          >
            Instalar ahora (~1,3 GB)
          </button>
        </div>
      )}

      {(state === 'downloading' || state === 'extracting') && (
        <div className="mb-2">
          <div className="flex justify-between text-sm text-slate-300 mb-2">
            <span>{state === 'extracting' ? 'Extrayendo e instalando…' : 'Descargando…'}</span>
            {state === 'downloading' && <span className="font-mono font-semibold text-slate-100">{progress}%</span>}
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-violet-500 h-3 rounded-full transition-all duration-500"
              style={{ width: state === 'extracting' ? '100%' : `${progress}%` }}
            />
          </div>
          {state === 'downloading' && (
            <button
              onClick={handleCancel}
              className="text-sm text-slate-400 hover:text-red-300 px-4 py-2.5 rounded-xl hover:bg-slate-700 transition-colors mt-2"
            >
              Cancelar
            </button>
          )}
        </div>
      )}

      {state === 'installed' && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 bg-emerald-900/30 border border-emerald-700/40 rounded-xl px-4 py-3">
            <span className="text-xl">✅</span>
            <div>
              <p className="text-sm font-semibold text-emerald-300">Aceleración por GPU instalada</p>
              <p className="text-xs text-emerald-400/70">La transcripción de voz usa tu GPU NVIDIA</p>
            </div>
          </div>
          <button
            onClick={handleUninstall}
            className="text-xs text-slate-500 hover:text-red-300 px-3 py-2 rounded-lg hover:bg-slate-700 transition-colors whitespace-nowrap"
          >
            Desinstalar
          </button>
        </div>
      )}

      {state === 'error' && (
        <div className="mb-2 bg-red-900/40 border border-red-700/50 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-300 mb-1">
            {errorMsg?.startsWith('No se pudo desinstalar') ? errorMsg : 'Error al descargar'}
          </p>
          {!errorMsg?.startsWith('No se pudo desinstalar') && (
            <p className="text-xs text-red-400/80 font-mono break-all">{errorMsg}</p>
          )}
          <button
            onClick={refresh}
            className="text-sm text-slate-400 hover:text-slate-200 px-3 py-2 rounded-xl hover:bg-slate-700 transition-colors mt-2"
          >
            Cerrar
          </button>
        </div>
      )}
    </CollapsibleCard>
  )
}

// ── Disponibilidad de estudio ─────────────────────────────────────────────
function StudyAvailabilityCard() {
  const [hours, setHours] = useState(() => loadWeeklyHours())
  const [saved, setSaved]  = useState(false)

  function handleChange(h) {
    setHours(h)
    setSaved(false)
  }

  function handleSave() {
    saveWeeklyHours(hours)
    pushSettings({ weeklyHours: hours })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <CollapsibleCard
      icon="📅"
      title="Disponibilidad de estudio"
      subtitle="Cuántas horas puedes dedicar cada día de la semana"
      defaultOpen={false}
    >
      <div className="space-y-4">
        <WeeklyHoursWidget hours={hours} onChange={handleChange} />
        <button
          onClick={handleSave}
          className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors
            ${saved
              ? 'bg-emerald-700 text-white'
              : 'bg-primary-600 hover:bg-primary-700 text-white'}`}
        >
          {saved ? '✅ Guardado' : '💾 Guardar disponibilidad'}
        </button>
        <p className="text-xs text-slate-500 leading-relaxed">
          El plan de estudio usará estas horas para distribuir los temas de forma realista.
          Puedes cambiarlas antes de generar cada plan concreto.
        </p>
      </div>
    </CollapsibleCard>
  )
}

// ── Página principal ──────────────────────────────────────────────────────
export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { addToast, ttsVoicesPerLang, ttsRate, setTtsVoiceForLang, setTtsRate, tutorTtsRate, setTutorTtsRate, langsTtsRate, setLangsTtsRate, apiBase, dailyGoalMinutes, setDailyGoalMinutes, responseLang, setResponseLang } = useAppStore()

  const [exporting, setExporting]               = useState(false)
  const [resetting, setResetting]               = useState(false)
  const [showFeedback, setShowFeedback]         = useState(false)

  // ── Abrir/desplegar "Tutoriales detallados" al llegar desde el cartel de bienvenida ──
  const tutorialsRef = useRef(null)
  const [tutorialsOpen, setTutorialsOpen] = useState(!!location.state?.openTutorials)
  useEffect(() => {
    if (location.state?.openTutorials && tutorialsRef.current) {
      tutorialsRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])

  // ── Borrar cuenta (permanente) ─────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal]   = useState(false)
  const [deletePassword, setDeletePassword]     = useState('')
  const [deleting, setDeleting]                 = useState(false)
  const [deleteError, setDeleteError]           = useState('')

  async function handleDeleteAccount() {
    if (!deletePassword) return
    setDeleting(true)
    setDeleteError('')
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email, password: deletePassword,
      })
      if (authError) {
        setDeleteError(t('settings.dangerZone.wrongPassword'))
        return
      }
      const authHeader = await getAuthHeader()
      const res = await fetch(`${WEB_API}/account/delete`, {
        method: 'POST', headers: { ...authHeader },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await supabase.auth.signOut()
      navigate('/login')
    } catch (e) {
      setDeleteError(e.message || t('settings.dangerZone.error'))
    } finally {
      setDeleting(false)
    }
  }

  // ── Apariencia (plantilla visual) ──────────────────────────────────────
  const [theme, setTheme] = useState(getTheme())
  function handleThemeChange(id) {
    applyTheme(id)
    setTheme(id)
    pushSettings({ theme: id })
  }

  // ── Perfil: nombre editable ────────────────────────────────────────────
  const [fullName, setFullName]     = useState('')
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    setFullName(user?.user_metadata?.full_name || '')
  }, [user])

  async function handleSaveName() {
    const trimmed = fullName.trim()
    setSavingName(true)
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: trimmed } })
      if (error) throw error
      addToast('Nombre actualizado ✓', 'success')
    } catch (e) {
      addToast('No se pudo guardar el nombre', 'error')
    } finally {
      setSavingName(false)
    }
  }

  // ── Perfil: cambiar contraseña ─────────────────────────────────────────
  const [newPassword, setNewPassword]           = useState('')
  const [confirmPassword, setConfirmPassword]   = useState('')
  const [savingPassword, setSavingPassword]     = useState(false)

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      addToast('La contraseña debe tener al menos 6 caracteres', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      addToast('Las contraseñas no coinciden', 'error')
      return
    }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      addToast('Contraseña actualizada ✓', 'success')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e) {
      addToast('No se pudo cambiar la contraseña', 'error')
    } finally {
      setSavingPassword(false)
    }
  }

  // ── Plan y facturación (Stripe, solo web) ──────────────────────────────
  const planTier = useAppStore(s => s.planTier)
  const [billingBusy, setBillingBusy] = useState(null) // 'pro' | 'transcription' | 'podcast' | 'portal' | null

  const STRIPE_PRICES = {
    pro:           'price_1U6EFGBUwE5wbpTtmWFqx4Jk',
    transcription: 'price_1U6EFGBUwE5wbpTtPo2IKUr0',
    podcast:       'price_1U6EFHBUwE5wbpTt0fQuBaqD',
  }

  useEffect(() => {
    const billing = new URLSearchParams(location.search).get('billing')
    if (billing === 'success') addToast('¡Pago completado! Puede tardar unos segundos en reflejarse.', 'success')
    else if (billing === 'cancel') addToast('Pago cancelado', 'info')
  }, [])

  async function handleCheckout(kind) {
    setBillingBusy(kind)
    try {
      const res = await api('POST', '/billing/create-checkout-session', { price_id: STRIPE_PRICES[kind] })
      window.location.href = res.url
    } catch (e) {
      addToast(e.message || 'No se pudo iniciar el pago', 'error')
      setBillingBusy(null)
    }
  }

  async function handlePortal() {
    setBillingBusy('portal')
    try {
      const res = await api('GET', '/billing/portal')
      window.location.href = res.url
    } catch (e) {
      addToast(e.message || 'Todavía no tienes ninguna compra', 'error')
      setBillingBusy(null)
    }
  }

  // ── Copias de seguridad (solo escritorio) ─────────────────────────────────
  const [backupStatus,   setBackupStatus]   = useState(null)   // { lastBackup, history, dbSizeMB, uploadsMB }
  const [backupBusy,     setBackupBusy]     = useState(false)  // haciendo copia manual
  const [exportingZip,   setExportingZip]   = useState(false)  // exportando ZIP

  useEffect(() => {
    if (!IS_ELECTRON || !window.electron?.backup) return
    window.electron.backup.status().then(s => { if (s.ok) setBackupStatus(s) })
  }, [])

  async function handleBackupNow() {
    if (!window.electron?.backup) return
    setBackupBusy(true)
    try {
      const r = await window.electron.backup.create()
      if (r.ok) {
        addToast(`✅ Copia creada (${r.sizeMB} MB)`, 'success')
        const s = await window.electron.backup.status()
        if (s.ok) setBackupStatus(s)
      } else {
        addToast('Error al crear copia: ' + r.reason, 'error')
      }
    } finally { setBackupBusy(false) }
  }

  async function handleExportZip() {
    if (!window.electron?.backup) return
    setExportingZip(true)
    try {
      const r = await window.electron.backup.export()
      if (r.ok) addToast(`✅ Exportado (${r.sizeMB} MB)`, 'success')
      else if (r.reason !== 'cancelled') addToast('Error al exportar: ' + r.reason, 'error')
    } finally { setExportingZip(false) }
  }

  // ── Avisos de examen — push real en web, bandeja + inicio en escritorio ────
  const [notifEnabled, setNotifEnabled]     = useState(true)
  const [notifDaysBefore, setNotifDaysBefore] = useState([7, 3, 1])
  const [notifBusy, setNotifBusy]           = useState(false)
  const [startWithSystem, setStartWithSystem] = useState(false)
  const [startMinimized, setStartMinimized]   = useState(false)

  useEffect(() => {
    if (IS_WEB) {
      if (!isPushSupported()) return
      isPushSubscribed().then(setNotifEnabled)
      api('GET', '/notifications/settings').then(s => {
        setNotifDaysBefore(s.days_before_list || [7, 3, 1])
      }).catch(() => {})
    } else if (window.electron?.notifSettings) {
      window.electron.notifSettings.get().then(s => {
        setNotifEnabled(s.notifEnabled)
        setNotifDaysBefore(s.notifDaysBefore || [7, 3, 1])
        setStartWithSystem(!!s.startWithSystem)
        setStartMinimized(!!s.startMinimized)
      })
    }
  }, [])

  async function handleToggleNotif(checked) {
    setNotifBusy(true)
    try {
      if (IS_WEB) {
        if (checked) {
          await subscribeToPush()
          await api('PUT', '/notifications/settings', { enabled: true })
        } else {
          await unsubscribeFromPush()
          await api('PUT', '/notifications/settings', { enabled: false })
        }
        setNotifEnabled(checked)
      } else if (window.electron?.notifSettings) {
        await window.electron.notifSettings.set({ notifEnabled: checked })
        setNotifEnabled(checked)
      }
    } catch (e) {
      // Duración más larga que el toast por defecto (4s) -- el mensaje de
      // permiso bloqueado explica varios pasos y 4s no da tiempo a leerlo.
      addToast(e.message || 'No se pudo cambiar los avisos', 'error', 9000)
    } finally {
      setNotifBusy(false)
    }
  }

  async function handleToggleDayThreshold(day) {
    const updated = notifDaysBefore.includes(day)
      ? notifDaysBefore.filter(d => d !== day)
      : [...notifDaysBefore, day].sort((a, b) => b - a)
    setNotifDaysBefore(updated)
    if (IS_WEB) {
      await api('PUT', '/notifications/settings', { days_before_list: updated }).catch(() => {})
    } else if (window.electron?.notifSettings) {
      await window.electron.notifSettings.set({ notifDaysBefore: updated })
    }
  }

  async function handleToggleStartWithSystem(checked) {
    setStartWithSystem(checked)
    await window.electron?.notifSettings.set({ startWithSystem: checked })
  }

  async function handleToggleStartMinimized(checked) {
    setStartMinimized(checked)
    await window.electron?.notifSettings.set({ startMinimized: checked })
  }

  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [archives, setArchives]                 = useState([])
  const [archiveName, setArchiveName]           = useState('')
  const [archiving, setArchiving]               = useState(false)
  const [restoringId, setRestoringId]           = useState(null)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(null)

  useEffect(() => {
    if (IS_ELECTRON) api('GET', '/archives').then(r => setArchives(r.items || [])).catch(() => {})
  }, [])

  async function exportCourse() {
    setExporting(true)
    try {
      const res = await fetch(`${apiBase}/export/course-data`, { headers: await getLocalAuthHeader() })
      if (!res.ok) throw new Error('Error al exportar')
      const blob = await res.blob()
      const cd = res.headers.get('content-disposition') || ''
      const nameMatch = cd.match(/filename="([^"]+)"/)
      const filename = nameMatch ? nameMatch[1] : 'studyai_export.json'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      addToast(t('settings.archive.exported'), 'success')
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setExporting(false)
    }
  }

  async function createArchive() {
    if (!archiveName.trim()) return
    setArchiving(true)
    try {
      const res = await api('POST', '/archives', { name: archiveName.trim() })
      setArchives(prev => [{ ...res, doc_count: 0, card_count: 0 }, ...prev])
      setArchiveName('')
      addToast(`Archivo "${res.name}" guardado`, 'success')
      api('GET', '/archives').then(r => setArchives(r.items || [])).catch(() => {})
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setArchiving(false)
    }
  }

  async function restoreArchive(id) {
    setRestoringId(id)
    try {
      const res = await api('POST', `/archives/${id}/restore`)
      setShowRestoreConfirm(null)
      addToast(res.message || 'Restaurado correctamente', 'success', 6000)
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setRestoringId(null)
    }
  }

  async function deleteArchive(id) {
    try {
      await api('DELETE', `/archives/${id}`)
      setArchives(prev => prev.filter(a => a.id !== id))
    } catch (e) {
      addToast(e.message, 'error')
    }
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch(`${apiBase}/archives/import-file`, { method: 'POST', headers: await getLocalAuthHeader(), body: form })
      if (!res.ok) throw new Error('Error al importar')
      const data = await res.json()
      addToast(`Archivo "${data.name}" importado`, 'success')
      api('GET', '/archives').then(r => setArchives(r.items || [])).catch(() => {})
    } catch (e) {
      addToast(e.message, 'error')
    }
    e.target.value = ''
  }

  async function resetCourse() {
    setResetting(true)
    try {
      await api('POST', '/settings/reset-course')
      setShowResetConfirm(false)
      addToast(t('settings.archive.resetDone'), 'success', 6000)
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setResetting(false)
    }
  }

  const [mistralOk, setMistralOk] = useState(null)

  useEffect(() => {
    api('GET', '/setup/check').then(r => {
      setMistralOk(r.mistral)
    }).catch(() => {})
  }, [])

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-3">
      <h1 className="text-2xl font-bold text-slate-100">{t('settings.title')}</h1>

      {/* ── Perfil ──────────────────────────────────────────────────── */}
      <CollapsibleCard icon="👤" title="Perfil" subtitle={user?.email} defaultOpen={false}>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Nombre</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tu nombre"
              className="input flex-1"
            />
            <button
              onClick={handleSaveName}
              disabled={savingName || fullName.trim() === (user?.user_metadata?.full_name || '')}
              className="btn-primary disabled:opacity-40"
            >{savingName ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800">
          <label className="block text-sm text-slate-400 mb-1 mt-2">Cambiar contraseña</label>
          <div className="grid grid-cols-2 gap-2">
            <PasswordInput
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nueva contraseña"
              autoComplete="new-password"
              className="input w-full"
            />
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              autoComplete="new-password"
              className="input w-full"
            />
          </div>
          <button
            onClick={handleChangePassword}
            disabled={savingPassword || !newPassword || !confirmPassword}
            className="btn-secondary btn-sm mt-2 disabled:opacity-40"
          >{savingPassword ? 'Guardando…' : 'Cambiar contraseña'}</button>
        </div>

        <div className="pt-2 border-t border-slate-800">
          <label className="block text-sm text-slate-400 mb-1 mt-2">Objetivo diario de estudio (minutos)</label>
          <input
            type="number"
            min={5}
            max={240}
            step={5}
            value={dailyGoalMinutes}
            onChange={(e) => setDailyGoalMinutes(e.target.value === '' ? '' : Number(e.target.value))}
            onBlur={(e) => setDailyGoalMinutes(Math.min(240, Math.max(5, Number(e.target.value) || 20)))}
            className="input w-28"
          />
          <p className="text-xs text-slate-500 mt-1">Solo informativo — no bloquea nada, es para que veas tu propio progreso del día.</p>
        </div>
      </CollapsibleCard>

      {/* ── Plan y facturación (solo web, Stripe) ──────────────────────── */}
      {IS_WEB && (
        <CollapsibleCard icon="💳" title="Plan y facturación" subtitle={planTier === 'pro' ? 'Pro' : planTier === 'trial' ? 'Prueba gratis' : 'Free'} defaultOpen={false}>
          {planTier !== 'pro' && (
            <div className="pb-3 border-b border-slate-800">
              <p className="text-sm text-slate-300 mb-2">Hazte Pro — 15€/mes, sin límite de generaciones.</p>
              <button
                onClick={() => handleCheckout('pro')}
                disabled={!!billingBusy}
                className="btn-primary disabled:opacity-40"
              >{billingBusy === 'pro' ? 'Redirigiendo…' : 'Hazte Pro'}</button>
            </div>
          )}

          <div className="pt-3">
            <p className="text-sm text-slate-400 mb-2">Bonos extra (pago único)</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleCheckout('transcription')}
                disabled={!!billingBusy}
                className="btn-secondary btn-sm disabled:opacity-40"
              >{billingBusy === 'transcription' ? 'Redirigiendo…' : '+10h transcripción — 3€'}</button>
              <button
                onClick={() => handleCheckout('podcast')}
                disabled={!!billingBusy}
                className="btn-secondary btn-sm disabled:opacity-40"
              >{billingBusy === 'podcast' ? 'Redirigiendo…' : '+10 podcasts — 7€'}</button>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 mt-3">
            <button
              onClick={handlePortal}
              disabled={!!billingBusy}
              className="text-sm text-slate-400 hover:text-slate-200 underline disabled:opacity-40"
            >{billingBusy === 'portal' ? 'Abriendo…' : 'Gestionar suscripción / facturas'}</button>
          </div>
        </CollapsibleCard>
      )}

      {/* ── Estado del sistema ──────────────────────────────────────── */}
      {/* Idéntico en las 3 plataformas — en escritorio /setup/check consulta lo
          mismo que la nube (ver main.py), así que el estado que ve el usuario
          es siempre el mismo sin importar por dónde entre. */}
      <CollapsibleCard title={t('settings.systemStatus.title')} defaultOpen={true}>
        {[
          { label: 'Servicio de generación', ok: mistralOk, optional: false },
          { label: 'Servicio de visión',     ok: mistralOk, optional: false },
          { label: 'Servicio OCR',           ok: mistralOk, optional: false },
        ].map(({ label, ok, optional }) => (
          <div key={label} className="flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${ok ? 'bg-emerald-400' : optional ? 'bg-slate-600' : 'bg-amber-400 animate-pulse'}`} />
            <span className="text-sm text-slate-300">
              <span className="text-slate-400">{label}</span>
              {': '}
              {ok === null ? 'verificando...' : ok ? '✅ Activo' : optional ? 'No configurado (opcional)' : '⚠️ Sin configurar'}
            </span>
          </div>
        ))}
      </CollapsibleCard>

      {/* ── Disponibilidad de estudio ────────────────────────────── */}
      <StudyAvailabilityCard />

      {/* ── TTS ─────────────────────────────────────────────────────── */}
      <CollapsibleCard
        icon="🔊"
        title={t('settings.tts.title')}
        subtitle={t('settings.tts.subtitle')}
        defaultOpen={false}
      >
        <div className="space-y-5">
          {/* Voces por idioma */}
          {TTS_LANG_GROUPS.map(group => (
            <div key={group.lang}>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <span>{group.flag}</span> {group.label}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {group.voices.map(v => {
                  const active = (ttsVoicesPerLang?.[group.lang] ?? '') === v.value
                  return (
                    <button
                      key={v.value}
                      onClick={() => setTtsVoiceForLang(group.lang, v.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs text-left transition-all ${
                        active
                          ? 'border-primary-500 bg-primary-900/40 text-primary-200'
                          : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:border-slate-600 hover:bg-slate-700/40'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-primary-400' : 'bg-slate-600'}`} />
                      <span className="flex-1">{v.label}</span>
                      {active && <span className="text-primary-400">✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Velocidad lectura de documentos */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">{t('settings.tts.speedDocs')}</label>
            <div className="flex flex-wrap gap-2">
              {TTS_RATES.map(r => (
                <button
                  key={r.value}
                  onClick={() => setTtsRate(r.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    ttsRate === r.value
                      ? 'border-primary-500 bg-primary-900/40 text-primary-200'
                      : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Velocidad voz del Tutor */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">{t('settings.tts.speedTutor')}</label>
            <div className="flex flex-wrap gap-2">
              {TTS_RATES.map(r => (
                <button
                  key={r.value}
                  onClick={() => setTutorTtsRate(r.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    tutorTtsRate === r.value
                      ? 'border-primary-500 bg-primary-900/40 text-primary-200'
                      : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Velocidad conversación de Idiomas */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">{t('settings.tts.speedLangs')}</label>
            <div className="flex flex-wrap gap-2">
              {TTS_RATES.map(r => (
                <button
                  key={r.value}
                  onClick={() => setLangsTtsRate(r.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    (langsTtsRate ?? '+12%') === r.value
                      ? 'border-primary-500 bg-primary-900/40 text-primary-200'
                      : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CollapsibleCard>

      {/* ── Archivo del curso (solo escritorio) ─────────────────────── */}
      {IS_ELECTRON && <CollapsibleCard
        icon="🗄️"
        title={t('settings.archive.title')}
        subtitle={t('settings.archive.subtitle')}
        defaultOpen={false}
      >
        {/* Crear nuevo archivo */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={t('settings.archive.namePlaceholder')}
            value={archiveName}
            onChange={e => setArchiveName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createArchive()}
            className="input flex-1 text-sm"
          />
          <button
            onClick={createArchive}
            disabled={!archiveName.trim() || archiving}
            className="btn-primary btn-sm shrink-0"
          >
            {archiving ? t('settings.archive.archiving') : t('settings.archive.archive')}
          </button>
        </div>

        {/* Lista de archivos guardados */}
        {archives.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{t('settings.archive.saved')}</p>
            {archives.map(a => (
              <div key={a.id} className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{a.name}</p>
                  <p className="text-[10px] text-slate-500">
                    {new Date(a.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {' · '}{a.doc_count} doc{a.doc_count !== 1 ? 's' : ''}
                    {' · '}{a.card_count} tarjeta{a.card_count !== 1 ? 's' : ''}
                  </p>
                </div>
                {showRestoreConfirm === a.id ? (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => restoreArchive(a.id)}
                      disabled={restoringId === a.id}
                      className="px-2 py-1 rounded bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium"
                    >
                      {restoringId === a.id ? '⏳' : t('settings.archive.confirmRestore')}
                    </button>
                    <button onClick={() => setShowRestoreConfirm(null)} className="px-2 py-1 rounded bg-slate-700 text-slate-300 text-xs">
                      {t('settings.archive.confirmNo')}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setShowRestoreConfirm(a.id)}
                      className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      {t('settings.archive.restore')}
                    </button>
                    <button
                      onClick={() => deleteArchive(a.id)}
                      className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {showRestoreConfirm && (
          <p className="text-xs text-amber-400 bg-amber-950/40 border border-amber-800 rounded-lg px-3 py-2">
            {t('settings.archive.restoreWarning')}
          </p>
        )}

        {/* Opciones externas */}
        <div className="border-t border-slate-700/60 pt-3 flex gap-3 flex-wrap items-center">
          <label className="btn-secondary btn-sm cursor-pointer">
            {t('settings.archive.importJson')}
            <input type="file" accept=".json" onChange={handleImportFile} className="hidden"/>
          </label>
          <button onClick={exportCourse} disabled={exporting} className="btn-secondary btn-sm">
            {exporting ? t('settings.archive.exporting') : t('settings.archive.export')}
          </button>
        </div>

        {/* Limpiar curso */}
        <div className="border-t border-slate-700/60 pt-3 space-y-3">
          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="px-3 py-1.5 rounded-lg bg-red-900/30 border border-red-800 text-red-300 hover:bg-red-800/40 text-sm transition-colors"
            >
              {t('settings.archive.resetTitle')}
            </button>
          ) : (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 space-y-3">
              <p className="text-sm text-red-200">
                {t('settings.archive.resetWarning')}
              </p>
              <div className="flex gap-2">
                <button onClick={resetCourse} disabled={resetting}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium">
                  {resetting ? t('settings.archive.resetting') : t('settings.archive.resetConfirm')}
                </button>
                <button onClick={() => setShowResetConfirm(false)} className="btn-secondary btn-sm">
                  {t('settings.archive.resetCancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      </CollapsibleCard>}

      {/* ── Whisper — motor de reconocimiento de voz (solo escritorio) ── */}
      {IS_ELECTRON && <WhisperCard />}
      {IS_ELECTRON && <CudaCard />}

      {/* ── Apariencia (plantilla visual) ────────────────────────────── */}
      <CollapsibleCard icon="🎨" title={t('settings.appearance.title')} defaultOpen={false}>
        <p className="text-xs text-slate-500 -mt-1">{t('settings.appearance.subtitle')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          {THEMES.map(th => (
            <button
              key={th.id}
              onClick={() => handleThemeChange(th.id)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                theme === th.id
                  ? 'border-primary-500 bg-primary-900/20'
                  : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
              }`}
            >
              <span
                className="w-10 h-10 rounded-full border border-slate-700 shrink-0"
                style={{ background: `linear-gradient(135deg, ${th.bg} 50%, ${th.accent} 50%)` }}
              />
              <span className="text-xs font-medium text-slate-200">{t(`settings.appearance.themes.${th.id}`)}</span>
              {theme === th.id && <span className="text-[10px] text-primary-400">{t('settings.appearance.active')}</span>}
            </button>
          ))}
        </div>
      </CollapsibleCard>

      {/* ── Idioma de la interfaz ─────────────────────────────────────── */}
      <CollapsibleCard icon="🌐" title={t('settings.language')} defaultOpen={false}>
        <div className="flex flex-wrap gap-3">
          {SUPPORTED_LANGS.map(lang => (
            <button
              key={lang.code}
              onClick={() => { i18n.changeLanguage(lang.code); pushSettings({ interfaceLang: lang.code }) }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                i18n.language?.startsWith(lang.code)
                  ? 'border-primary-500 bg-primary-900/30 text-primary-200'
                  : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:border-slate-600'
              }`}
            >
              <span className="text-lg">{lang.flag}</span>
              <span>{lang.label}</span>
              {i18n.language === lang.code && <span className="text-primary-400 text-xs">✓</span>}
            </button>
          ))}
        </div>
      </CollapsibleCard>

      {/* ── Idioma de respuesta de la IA (resúmenes, fichas, exámenes...) ── */}
      <CollapsibleCard icon="🤖" title={t('settings.responseLang.title')} subtitle={t('settings.responseLang.subtitle')} defaultOpen={false}>
        <div className="flex flex-wrap gap-3">
          {RESPONSE_LANGS.map(lang => (
            <button
              key={lang.code}
              onClick={() => setResponseLang(lang.code)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                responseLang === lang.code
                  ? 'border-primary-500 bg-primary-900/30 text-primary-200'
                  : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:border-slate-600'
              }`}
            >
              <span className="text-lg">{lang.flag}</span>
              <span>{lang.label}</span>
              {responseLang === lang.code && <span className="text-primary-400 text-xs">✓</span>}
            </button>
          ))}
        </div>
      </CollapsibleCard>

      {/* ── Avisos de examen ─────────────────────────────────────────── */}
      <CollapsibleCard icon="🔔" title={t('settings.notifications.title')} defaultOpen={false}>
        {IS_WEB && !isPushSupported() ? (
          <p className="text-sm text-slate-500">{t('settings.notifications.unsupported')}</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-200">{t('settings.notifications.enable')}</p>
                <p className="text-xs text-slate-500">{t('settings.notifications.enableDesc')}</p>
              </div>
              <button
                onClick={() => handleToggleNotif(!notifEnabled)}
                disabled={notifBusy}
                className={`w-12 h-6 rounded-full transition-colors relative shrink-0 disabled:opacity-50 ${notifEnabled ? 'bg-primary-600' : 'bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${notifEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            {notifEnabled && (
              <div className="pt-3 border-t border-slate-800">
                <p className="text-xs text-slate-400 mb-2">{t('settings.notifications.daysBefore')}</p>
                <div className="flex gap-2">
                  {[7, 3, 1].map(day => (
                    <button
                      key={day}
                      onClick={() => handleToggleDayThreshold(day)}
                      className={`px-3 py-1.5 rounded-lg text-sm border-2 transition-all ${
                        notifDaysBefore.includes(day)
                          ? 'border-primary-500 bg-primary-900/30 text-primary-200'
                          : 'border-slate-700 bg-slate-800/40 text-slate-400'
                      }`}
                    >{day} {day === 1 ? t('settings.notifications.day') : t('settings.notifications.days')}</button>
                  ))}
                </div>
              </div>
            )}

            {IS_ELECTRON && (
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{t('settings.notifications.startWithSystem')}</p>
                    <p className="text-xs text-slate-500">{t('settings.notifications.startWithSystemDesc')}</p>
                  </div>
                  <button
                    onClick={() => handleToggleStartWithSystem(!startWithSystem)}
                    className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${startWithSystem ? 'bg-primary-600' : 'bg-slate-700'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${startWithSystem ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{t('settings.notifications.startMinimized')}</p>
                    <p className="text-xs text-slate-500">{t('settings.notifications.startMinimizedDesc')}</p>
                  </div>
                  <button
                    onClick={() => handleToggleStartMinimized(!startMinimized)}
                    className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${startMinimized ? 'bg-primary-600' : 'bg-slate-700'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${startMinimized ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </CollapsibleCard>

      {/* ── Copias de seguridad (solo escritorio) ───────────────────── */}
      {IS_ELECTRON && (
        <CollapsibleCard title="💾 Datos y copias de seguridad" defaultOpen={false}>
          {/* Info de tamaños */}
          {backupStatus && (
            <div className="flex gap-4 text-xs text-slate-400 mb-4">
              <span>Base de datos: <span className="text-slate-200">{backupStatus.dbSizeMB} MB</span></span>
              <span>PDFs subidos: <span className="text-slate-200">{backupStatus.uploadsMB} MB</span></span>
            </div>
          )}

          {/* Última copia */}
          <div className="mb-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700/40 text-sm">
            <p className="text-slate-300 font-medium mb-1">Última copia de seguridad</p>
            {backupStatus?.lastBackup
              ? <p className="text-slate-400 text-xs">{new Date(backupStatus.lastBackup).toLocaleString('es-ES')}</p>
              : <p className="text-slate-500 text-xs">Ninguna todavía</p>
            }
          </div>

          {/* Explicación */}
          <div className="mb-4 text-xs text-slate-500 space-y-1">
            <p>📌 <strong className="text-slate-400">Copia automática:</strong> Se hace una copia de la base de datos cada 7 días y justo antes de instalar cada actualización. Se guardan las últimas 5 copias en <code className="text-slate-300">~/.studyai/backups/</code></p>
            <p>📦 <strong className="text-slate-400">Exportar:</strong> Crea un ZIP con la base de datos + todos los PDFs subidos. Puedes guardarlo en cualquier sitio (USB, nube, etc.)</p>
          </div>

          {/* Botones */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleBackupNow}
              disabled={backupBusy}
              className="btn-secondary btn-sm flex items-center gap-2"
            >
              {backupBusy ? <span className="animate-spin">⟳</span> : '💾'}
              {backupBusy ? 'Copiando…' : 'Hacer copia ahora'}
            </button>

            <button
              onClick={handleExportZip}
              disabled={exportingZip}
              className="btn-secondary btn-sm flex items-center gap-2"
            >
              {exportingZip ? <span className="animate-spin">⟳</span> : '📦'}
              {exportingZip ? 'Exportando…' : 'Exportar biblioteca (ZIP)'}
            </button>
          </div>

          {/* Historial reciente */}
          {backupStatus?.history?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700/40">
              <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Copias recientes</p>
              <div className="space-y-1">
                {backupStatus.history.slice(0, 5).map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{h.reason === 'pre-update' ? '🔄' : h.reason === 'manual' ? '👤' : '⏰'}</span>
                    <span className="text-slate-400">{new Date(h.date).toLocaleString('es-ES')}</span>
                    <span className="text-slate-600">— {h.reason === 'pre-update' ? 'pre-actualización' : h.reason === 'manual' ? 'manual' : 'automática'}</span>
                    <span className="ml-auto text-slate-600">{h.sizeMB} MB</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CollapsibleCard>
      )}

      {/* ── Ayúdanos a mejorar ───────────────────────────────────────── */}
      <div className="card p-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-slate-200">💬 Ayúdanos a mejorar</p>
          <p className="text-xs text-slate-500 mt-0.5">Errores, sugerencias o lo que quieras contarnos</p>
        </div>
        <button onClick={() => setShowFeedback(true)} className="btn-primary btn-sm shrink-0">
          Enviar feedback
        </button>
      </div>
      <FeedbackModal open={showFeedback} onClose={() => setShowFeedback(false)} platform={IS_WEB ? 'web' : 'desktop'} />

      {/* ── Tutoriales detallados por sección ──────────────────────────── */}
      <div ref={tutorialsRef}>
      <CollapsibleCard
        title={t('settings.tutorials.cardTitle')}
        subtitle={t('settings.tutorials.cardSubtitle')}
        defaultOpen={tutorialsOpen}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TUTORIAL_SECTION_KEYS.map(key => (
            <button
              key={key}
              onClick={() => window.dispatchEvent(new CustomEvent('studyai:show-onboarding', { detail: { section: key } }))}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 hover:border-primary-600 hover:bg-slate-800 transition-colors text-left"
            >
              <IconBadge icon={TUTORIAL_SECTION_ICONS[key]?.Icon} emoji={TUTORIAL_SECTION_ICONS[key]?.emoji} color={TUTORIAL_SECTION_ICONS[key]?.color} size="sm" />
              <span className="text-sm text-slate-200 truncate">{t(`settings.tutorials.sections.${key}.label`)}</span>
            </button>
          ))}
        </div>
      </CollapsibleCard>
      </div>

      {/* ── Acerca de ────────────────────────────────────────────────── */}
      <CollapsibleCard title={t('settings.about.title')} defaultOpen={false}>
        <p className="text-sm text-slate-400">{t('settings.about.version')}</p>
        <p className="text-xs text-slate-500">{t('settings.about.privacy')}</p>

        {/* ── Buscar actualizaciones (solo escritorio) ── */}
        {IS_ELECTRON && <UpdateChecker />}

        <button
          onClick={() => {
            setTutorialsOpen(true)
            tutorialsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }}
          className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl border border-primary-700/50 bg-primary-900/20 hover:bg-primary-800/30 text-primary-300 text-sm font-medium transition-colors"
        >
          {t('settings.about.tutorial')}
        </button>

        {/* ── Atribuciones de software de terceros (requerido por licencias) ── */}
        {IS_ELECTRON && (
          <div className="mt-4 pt-4 border-t border-slate-700/50">
            <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Software de terceros incluido</p>
            <div className="space-y-1.5 text-xs text-slate-500">
              <p>
                <span className="text-slate-400 font-medium">FFmpeg</span> — Copyright © the FFmpeg developers.
                Licencia LGPL v2.1+.{' '}
                <button
                  onClick={() => window.electron?.shell?.openExternal('https://ffmpeg.org/legal.html')}
                  className="text-primary-400 hover:text-primary-300 underline"
                >ffmpeg.org/legal.html</button>
              </p>
              <p>
                <span className="text-slate-400 font-medium">Whisper / faster-whisper</span> — Copyright © OpenAI (modelo), Systran (faster-whisper).
                Licencia MIT.
              </p>
              <p>
                <span className="text-slate-400 font-medium">Tesseract OCR</span> — Copyright © Google LLC.
                Licencia Apache 2.0.
              </p>
              <p>
                <span className="text-slate-400 font-medium">Electron</span> — Copyright © GitHub Inc.
                Licencia MIT.
              </p>
            </div>
          </div>
        )}
      </CollapsibleCard>

      {/* ── Zona de peligro ──────────────────────────────────────────── */}
      <div className="card border-red-900/50 p-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-red-400">{t('settings.dangerZone.title')}</p>
          <p className="text-xs text-slate-500 mt-0.5">{t('settings.dangerZone.subtitle')}</p>
        </div>
        <button
          onClick={() => { setShowDeleteModal(true); setDeletePassword(''); setDeleteError('') }}
          className="btn-secondary btn-sm shrink-0 border-red-800 text-red-400 hover:bg-red-900/30"
        >
          {t('settings.dangerZone.deleteButton')}
        </button>
      </div>

      <Modal open={showDeleteModal} onClose={() => !deleting && setShowDeleteModal(false)} title={t('settings.dangerZone.modalTitle')} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">{t('settings.dangerZone.modalWarning')}</p>
          <ul className="text-xs text-slate-400 list-disc list-inside space-y-1">
            <li>{t('settings.dangerZone.warningDocs')}</li>
            <li>{t('settings.dangerZone.warningFlashcards')}</li>
            <li>{t('settings.dangerZone.warningAccount')}</li>
          </ul>
          <div>
            <label className="block text-sm text-slate-400 mb-1">{t('settings.dangerZone.passwordLabel')}</label>
            <PasswordInput
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDeleteAccount()}
              placeholder="••••••••"
              autoComplete="current-password"
              className="input w-full"
            />
          </div>
          {deleteError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              {deleteError}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShowDeleteModal(false)}
              disabled={deleting}
              className="btn-secondary flex-1"
            >
              {t('settings.dangerZone.cancel')}
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deleting || !deletePassword}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-xl transition-all"
            >
              {deleting ? t('settings.dangerZone.deleting') : t('settings.dangerZone.confirmDelete')}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Enlaces legales ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 pt-2">
        <Link to="/terminos" target="_blank" className="hover:text-slate-300">{t('landing.footer.terms')}</Link>
        <Link to="/privacidad" target="_blank" className="hover:text-slate-300">{t('landing.footer.privacy')}</Link>
        <Link to="/cookies" target="_blank" className="hover:text-slate-300">Cookies</Link>
        <a href="mailto:support@mystudyai.eu" className="hover:text-slate-300">support@mystudyai.eu</a>
      </div>
    </div>
  )
}

function CollapsibleCard({ icon, title, subtitle, defaultOpen = false, children }) {
  return (
    <details className="card group" open={defaultOpen}>
      <summary className="flex items-center gap-3 cursor-pointer list-none select-none">
        {icon && <span className="text-xl shrink-0">{icon}</span>}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-200">{title}</p>
          {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        </div>
        <span className="text-slate-500 transition-transform group-open:rotate-180 shrink-0">▾</span>
      </summary>
      <div className="mt-4 space-y-4">
        {children}
      </div>
    </details>
  )
}
