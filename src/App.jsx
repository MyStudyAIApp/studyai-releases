import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAppStore, api, IS_WEB, IS_MOBILE, IS_ELECTRON, detectIsFullMobileApp } from './store/appStore'
import MobileApp from './mobile/MobileApp'
import Layout from './components/Layout/Layout'
import Home from './pages/Home'
import Library from './pages/Library'
import DocumentPage from './pages/DocumentPage'
import TopicPage from './pages/TopicPage'
import StudySession from './pages/StudySession'
import ExamPage from './pages/ExamPage'
import StatsPage from './pages/StatsPage'
import SettingsPage from './pages/SettingsPage'
import ComparePage from './pages/ComparePage'
import LecturePage from './pages/LecturePage'
import ExerciseSolverPage from './pages/ExerciseSolverPage'
import TutorPage from './pages/TutorPage'
import LanguagesPage from './pages/LanguagesPage'
import CalendarPage from './pages/CalendarPage'
import ToastContainer from './components/UI/ToastContainer'
import OnboardingTutorial from './components/Onboarding/OnboardingTutorial'
import WelcomeCard from './components/Onboarding/WelcomeCard'
import LoginPage from './pages/LoginPage'
import LandingPage from './pages/LandingPage'
import LegalPlaceholderPage from './pages/LegalPlaceholderPage'
import AdminPage from './pages/AdminPage'
import SyncPage from './pages/SyncPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import DeleteAccountInfoPage from './pages/DeleteAccountInfoPage'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import UpdateNotification from './components/UpdateNotification'
import WhisperSetup from './components/WhisperSetup'
import { pullFromCloud } from './services/syncService'
import { fetchSettings } from './services/settingsSync'
import { applyTheme } from './services/themeService'
import { saveWeeklyHours } from './components/Study/WeeklyHoursWidget'
import i18n from './i18n'

// ── Candado de MyStudy Admin ──────────────────────────────────────────────────
// La app MyStudy Admin (Capacitor aparte, solo para el dueño) navega aquí con
// ?adminLock=1 (delante del #, así llega como parámetro real de la URL, no
// como parte del hash de la SPA), y el candado bloquea toda ruta que no sea el
// panel para que ese acceso rápido no acabe navegando por el resto de la cuenta.
//
// ⚠️ Vive en sessionStorage, NO en localStorage. Con localStorage bastaba abrir
// esa URL UNA vez en un navegador para dejarlo encerrado en el panel PARA
// SIEMPRE, sin forma de volver a usar la web normal. No era hipotético: la app
// Admin no tiene `server.allowNavigation`, así que Capacitor le pasaba la URL
// al navegador del sistema, y cada arranque de la app candaba el Chrome del
// dueño (3/9/2026). Persistir no aportaba nada, además, porque la app SIEMPRE
// llega con el parámetro en la URL: el candado se vuelve a poner solo en cada
// arranque. Por pestaña protege igual y se deshace al cerrarla.
if (typeof window !== 'undefined') {
  const marca = new URLSearchParams(window.location.search).get('adminLock')
  if (marca === '1') sessionStorage.setItem('studyai_admin_lock', '1')
  else if (marca === '0') sessionStorage.removeItem('studyai_admin_lock')
  // Limpia el candado permanente que dejaron las versiones anteriores.
  localStorage.removeItem('studyai_admin_lock')
}

// ── Guardia de rutas ──────────────────────────────────────────────────────────
// Redirige a /login si no hay sesión (web y escritorio)
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400 animate-pulse text-lg">Cargando...</div>
    </div>
  )
  // Guarda a dónde iba (ej. /admin) para volver ahí tras el login, en vez de
  // caer siempre en /home -- lo necesita la app MyStudy Admin, que abre
  // directamente en /admin.
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return children
}

// "/" — landing pública (solo web) si no hay sesión, si no va directo a /home o /login
function RootRoute() {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400 animate-pulse text-lg">Cargando...</div>
    </div>
  )
  if (user) return <Navigate to="/home" replace />
  if (!IS_WEB) return <Navigate to="/login" replace />
  return <LandingPage />
}

// ── Núcleo de la app ──────────────────────────────────────────────────────────
// Separado de App() para poder usar useAuth() (que necesita estar DENTRO de <AuthProvider>)
function AppInner() {
  const { backendReady, setBackendReady, setBackendError, addToast, setTodayStudyMinutes, applySyncedSettings } = useAppStore()
  const { user, isPasswordRecovery } = useAuth()  // ahora sí podemos usarlo (estamos dentro del AuthProvider)

  // ── Ajustes sincronizados entre plataformas (voz, tema, idioma, horas...) ──
  // Al iniciar sesión (una vez por sesión de app, no en cada render) se traen
  // del perfil de la nube y se aplican encima de lo que hubiera local — la
  // nube manda si hay conflicto. Ver src/services/settingsSync.js.
  useEffect(() => {
    if (!backendReady || !user) return
    fetchSettings().then(s => {
      if (!s || Object.keys(s).length === 0) return
      applySyncedSettings(s)
      if (s.theme) applyTheme(s.theme)
      if (s.interfaceLang) i18n.changeLanguage(s.interfaceLang)
      if (s.weeklyHours) saveWeeklyHours(s.weeklyHours)
    })
  }, [backendReady, user?.id])

  // Cartel de bienvenida (primer arranque) — solo avisa de los tutoriales
  // detallados por sección en Ajustes, ya no hay recorrido general por toda la app
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem('onboarding_done'))
  // Tutorial detallado de una sola sección, lanzado desde Ajustes
  const [onboardingSection, setOnboardingSection] = useState(null)
  const navigate = useNavigate()
  const routeLocation = useLocation()

  // Whisper — mostrar pantalla de descarga si el modelo no está instalado
  // (solo en Electron; en web no existe Whisper local)
  const [showWhisperSetup, setShowWhisperSetup] = useState(false)

  // null mientras se resuelve (solo relevante en IS_MOBILE) — ver detectIsFullMobileApp
  const [isFullMobileApp, setIsFullMobileApp] = useState(null)
  useEffect(() => {
    if (!IS_MOBILE) return
    detectIsFullMobileApp().then(setIsFullMobileApp)
  }, [])

  // Ajustes dispara este evento con la sección elegida para abrir su tutorial
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.section) setOnboardingSection(e.detail.section)
    }
    window.addEventListener('studyai:show-onboarding', handler)
    return () => window.removeEventListener('studyai:show-onboarding', handler)
  }, [])

  function dismissWelcome() {
    localStorage.setItem('onboarding_done', '1')
    setShowWelcome(false)
  }
  function goToTutorials() {
    localStorage.setItem('onboarding_done', '1')
    setShowWelcome(false)
    navigate('/settings', { state: { openTutorials: true } })
  }

  useEffect(() => {
    // Escuchar el evento del proceso principal cuando el backend esté listo
    if (window.electronAPI?.onBackendReady) {
      window.electronAPI.onBackendReady(() => check())
    }

    const check = async () => {
      try {
        await api('GET', '/health')
        setBackendReady(true)
        // Notificaciones de arranque (pequeño retraso para no saturar el inicio)
        setTimeout(async () => {
          try {
            const notifs = await api('GET', '/notifications/startup')
            // Tarjetas pendientes de repaso
            if (notifs.due_cards > 0) {
              addToast(
                `🧠 Tienes ${notifs.due_cards} tarjeta${notifs.due_cards > 1 ? 's' : ''} pendiente${notifs.due_cards > 1 ? 's' : ''} de repaso hoy`,
                'info', 6000
              )
            }
            // Exámenes próximos
            for (const exam of notifs.upcoming_exams) {
              const when = exam.days_left === 0 ? '¡hoy!'
                         : exam.days_left === 1 ? 'mañana'
                         : `en ${exam.days_left} días`
              const msg = `📅 Examen: ${exam.title} — ${when}`
              addToast(msg, exam.days_left <= 1 ? 'error' : 'warning', 8000)
              // La notificación nativa del sistema operativo ya la manda el
              // cron del backend (/admin/check-exam-notifications) vía Web
              // Push -- esa sí lleva control de duplicados (notified_thresholds).
              // Repetirla aquí en cada arranque de la app duplicaba el aviso.
            }
          } catch { /* notificaciones opcionales, no crítico */ }
        }, 2000)
      } catch {
        setBackendError('No se puede conectar con el servicio')
        setTimeout(check, 3000)
      }
    }
    check()
  }, [])

  // ── Objetivo diario de estudio: recuperar minutos de hoy ya guardados ───────
  useEffect(() => {
    if (!backendReady) return
    api('GET', '/study-sessions/today')
      .then(r => setTodayStudyMinutes(r.minutes_today || 0))
      .catch(() => {})
  }, [backendReady])

  // ── Auto-descarga al arrancar (SOLO escritorio Electron + usuario logueado + backend listo) ──
  // Solo trae documentos que ya subiste tú mismo desde la web/móvil — es seguro
  // porque no crea nada nuevo en la nube, solo refleja lo que ya pusiste allí.
  // La SUBIDA (runSync) ya NO es automática — el usuario decide cuándo subir
  // cada documento con el botón "☁️ Subir" en Biblioteca (ver syncSingleDocument
  // en syncService.js), para evitar sorpresas y tener control real.
  useEffect(() => {
    if (!backendReady || !user || !IS_ELECTRON) return
    const t = setTimeout(async () => {
      await pullFromCloud(user)
    }, 8000)
    return () => clearTimeout(t)
  }, [backendReady, user])

  // ── Comprobar si Whisper está instalado (solo escritorio) ───────────────────
  useEffect(() => {
    if (!backendReady) return
    const api = window.electron?.whisper
    if (!api) return  // modo web — no aplica

    // Si el usuario ya dijo "instalar después", no volver a molestar en este arranque
    const postponed = localStorage.getItem('studyai-whisper-postponed')
    if (postponed) return

    api.check().then(({ installed }) => {
      if (!installed) setShowWhisperSetup(true)
    }).catch(() => { /* silencioso */ })
  }, [backendReady])

  // "Modo candado" -- lo activa MyStudy Admin (app aparte, solo para el
  // dueño) marcando localStorage antes de redirigir a /#/admin. Bloquea
  // cualquier ruta que no sea /admin o /login, para que ese acceso rápido no
  // pueda acabar navegando por accidente al resto de la cuenta.
  // Este hook tiene que ir ANTES de los `return` condicionales de abajo
  // (recuperación de contraseña / móvil reducido) -- si no, el número de
  // hooks ejecutados varía entre renders y React lanza "Rendered more
  // hooks than during the previous render" (visto en producción vía Sentry,
  // solo en Android WebView, porque ahí SÍ se pasa por el return de móvil).
  const isAdminLockedApp = typeof window !== 'undefined' && sessionStorage.getItem('studyai_admin_lock') === '1'
  useEffect(() => {
    if (!isAdminLockedApp) return
    // Las paginas legales quedan fuera del candado: son publicas, no dan
    // acceso a nada de la cuenta, y la ley obliga a que se puedan consultar.
    const PERMITIDAS = ['/admin', '/login', '/terminos', '/privacidad', '/cookies']
    if (!PERMITIDAS.includes(routeLocation.pathname)) {
      navigate('/admin', { replace: true })
    }
  }, [isAdminLockedApp, routeLocation.pathname])

  // Si el usuario llegó desde el enlace de "restablecer contraseña",
  // mostramos solo ese formulario (el hash del token ya fue procesado por Supabase).
  // Antes solo se comprobaba en IS_WEB — en móvil (MyStudy App) el evento
  // PASSWORD_RECOVERY también llega y abre sesión igual, pero nunca se
  // mostraba esta pantalla: quien abriera el enlace entraba directo a la
  // cuenta sin tener que fijar la contraseña nueva.
  if (isPasswordRecovery) {
    return <ResetPasswordPage />
  }

  // Móvil: dos apps Capacitor distintas comparten este mismo código —
  // "MyStudy Scan" (reducida, solo escanear/grabar) y "MyStudy App" (la app
  // completa, mismas pantallas que escritorio/web). Antes de decidir cuál
  // mostrar hay que comprobar el ID de paquete real (ver detectIsFullMobileApp).
  if (IS_MOBILE) {
    if (isFullMobileApp === null) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="text-slate-400 animate-pulse text-lg">Cargando...</div>
        </div>
      )
    }
    if (!isFullMobileApp) {
      return (
        <>
          <MobileApp />
          <ToastContainer />
        </>
      )
    }
    // isFullMobileApp === true: sigue abajo y renderiza el árbol completo (mismo que web)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      <Routes>
        <Route path="/"             element={<RootRoute />} />
        <Route path="/login"        element={<LoginPage />} />
        <Route path="/terminos"     element={<LegalPlaceholderPage docKey="terms" />} />
        <Route path="/privacidad"   element={<LegalPlaceholderPage docKey="privacy" />} />
        <Route path="/cookies"      element={<LegalPlaceholderPage docKey="cookies" />} />
        <Route path="/delete-account" element={<DeleteAccountInfoPage />} />
        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/home"        element={<Home />} />
          <Route path="/library"     element={<Library />} />
          <Route path="/document/:id" element={<DocumentPage />} />
          <Route path="/topic/:id"    element={<TopicPage />} />
          <Route path="/study/:subjectId?" element={<StudySession />} />
          <Route path="/exam/:documentId?" element={<ExamPage />} />
          <Route path="/stats"       element={<StatsPage />} />
          <Route path="/compare"     element={<ComparePage />} />
          <Route path="/lecture"     element={<LecturePage />} />
          <Route path="/solve"       element={<ExerciseSolverPage />} />
          <Route path="/tutor"       element={<TutorPage />} />
          <Route path="/languages"   element={<LanguagesPage />} />
          <Route path="/calendar"    element={<CalendarPage />} />
          <Route path="/settings"    element={<SettingsPage />} />
          {IS_ELECTRON && <Route path="/sync" element={<SyncPage />} />}
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Route>
      </Routes>

      {showWelcome && backendReady && !!user && (
        <WelcomeCard onGo={goToTutorials} onClose={dismissWelcome} />
      )}
      {!showWelcome && onboardingSection && backendReady && !!user && (
        <OnboardingTutorial
          section={onboardingSection}
          onFinish={() => setOnboardingSection(null)}
        />
      )}
      {!showWelcome && !onboardingSection && showWhisperSetup && !IS_WEB && !!user && (
        <WhisperSetup onDismiss={() => setShowWhisperSetup(false)} />
      )}

      <ToastContainer />
      <UpdateNotification />
    </div>
  )
}

// ── Punto de entrada ──────────────────────────────────────────────────────────
// App solo crea el AuthProvider y envuelve AppInner.
// Así AppInner puede usar useAuth() correctamente.
export default function App() {
  return (
    <AuthProvider>
      <div className="dark">
        <AppInner />
      </div>
    </AuthProvider>
  )
}
