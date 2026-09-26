import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAppStore, IS_ELECTRON, api } from '../../store/appStore'
import { useAuth } from '../../contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import { verFuncion } from '../../lib/betaFlags'
import {
  IconHome, IconBooks, IconNotebook, IconBrain, IconFileText, IconWorld, IconMicrophone2,
  IconCalculator, IconScale, IconChartBar, IconCalendar, IconSettings, IconCloud,
  IconLogout, IconBook, IconChevronDown, IconCalendarEvent, IconSparkles, IconCards, IconClipboardCheck,
} from '@tabler/icons-react'
import ProgressBar from '../UI/ProgressBar'
import IconBadge from '../UI/IconBadge'

// cajon: en móvil (MyStudy App y web estrecha) la barra entra como un cajón
// deslizante a pantalla casi completa, con los textos siempre visibles.
// alNavegar lo cierra al elegir una sección.
export default function Sidebar({ cajon = false, alNavegar }) {
  // En el cajón los textos se ven siempre; en la barra fija, solo en pantalla ancha.
  const L = cajon ? 'block' : 'hidden lg:block'
  const TIP = cajon ? 'hidden' : 'lg:hidden'

  const { t } = useTranslation()
  const { backendReady, todayStudyMinutes, dailyGoalMinutes, setPlanTier } = useAppStore()
  const { user, signOut, loading: authLoading } = useAuth()
  // user_metadata.full_name -- misma fuente que edita Ajustes, ver TitleBar.jsx.
  const displayName = user?.user_metadata?.full_name || null

  // /usage/summary devuelve el tier REAL (incluye plan_override='pro' manual,
  // que el cálculo local de getPlanTier() no puede conocer) — se guarda en el
  // store global para que PlanBadge también lo use, en vez de cada uno
  // calculando su propia versión (potencialmente distinta) del plan.
  // authLoading evita disparar la llamada antes de que la sesión esté lista
  // (causaba un 401 benigno en cada login, detectado en pruebas de QA).
  useEffect(() => {
    if (!backendReady || authLoading) return
    api('GET', '/usage/summary').then(data => setPlanTier(data.tier)).catch(() => {})
  }, [backendReady, authLoading])

  // Tutor conserva su mascota 🦉 (emoji), pero dentro de la misma insignia
  // circular que el resto — si no, se ve "plana" al lado de los iconos nuevos.
  const navItems = [
    { to: '/home',      Icon: IconHome,        color: 'blue',   label: t('sidebar.home') },
    { to: '/library',   Icon: IconBooks,       color: 'purple', label: t('sidebar.library') },
    // En pruebas: hasta que este rodado solo lo ve el propietario (lib/betaFlags).
    // El backend ademas devuelve 404 a los demas, ocultar el boton no basta.
    ...(verFuncion('cuaderno', user)
      ? [{ to: '/cuaderno', Icon: IconNotebook, color: 'teal', label: t('sidebar.notebook') }]
      : []),
    // Estudiar: se despliega con lo que se puede generar; cada opción deja
    // elegir uno o varios apuntes (pages/StudyPickerPage.jsx).
    { group: 'study', Icon: IconSparkles, color: 'amber', label: t('sidebar.studyGroup'), children: [
      { to: '/crear/summary', Icon: IconFileText,       color: 'purple', label: t('actionPanel.main.summary') },
      { to: '/crear/cards',   Icon: IconCards,          color: 'green',  label: t('actionPanel.main.cards') },
      { to: '/crear/exam',    Icon: IconClipboardCheck, color: 'amber',  label: t('actionPanel.main.exam') },
    ] },
    { to: '/plan',      Icon: IconCalendarEvent, color: 'pink', label: t('sidebar.studyPlan') },
    { to: '/study',     Icon: IconBrain,       color: 'green',  label: t('sidebar.study') },
    { to: '/tutor',     emoji: '🦉', color: 'purple', label: t('sidebar.tutor') },
    { to: '/languages', Icon: IconWorld,       color: 'teal',   label: t('sidebar.languages') },
    { to: '/lecture',   Icon: IconMicrophone2, color: 'pink',   label: t('sidebar.lecture') },
    { to: '/solve',     Icon: IconCalculator,  color: 'blue',   label: t('sidebar.solveExercise') },
    { to: '/compare',   Icon: IconScale,       color: 'purple', label: t('sidebar.compare') },
    { to: '/stats',     Icon: IconChartBar,    color: 'green',  label: t('sidebar.stats') },
    { to: '/calendar',  Icon: IconCalendar,    color: 'amber',  label: t('sidebar.calendar') },
    { to: '/settings',  Icon: IconSettings,    color: 'slate',  label: t('sidebar.settings') },
    ...(IS_ELECTRON ? [{ to: '/sync', Icon: IconCloud, color: 'blue', label: t('sidebar.sync') }] : []),
  ]

  // Tutoriales: desplegable debajo de Ajustes, uno por sección, con el mismo
  // icono que su entrada del menú. Cada uno lanza el recorrido de esa pantalla.
  const SECCION = { '/home': 'home', '/library': 'library', '/cuaderno': 'cuaderno', '/study': 'study',
    '/exam': 'exam', '/tutor': 'tutor', '/languages': 'languages', '/lecture': 'lecture', '/solve': 'solve',
    '/compare': 'compare', '/stats': 'stats', '/calendar': 'calendar', '/settings': 'settings' }
  const tutoriales = navItems.filter(n => SECCION[n.to])
  const [tutorialesAbierto, setTutorialesAbierto] = useState(false)
  const location = useLocation()
  const [estudiarAbierto, setEstudiarAbierto] = useState(() => /^\/crear/.test(location.pathname))
  // El cartel de bienvenida ("Ver tutoriales") abre este desplegable.
  useEffect(() => {
    const abrir = () => setTutorialesAbierto(true)
    window.addEventListener('studyai:open-tutorials', abrir)
    return () => window.removeEventListener('studyai:open-tutorials', abrir)
  }, [])

  return (
    <aside className={`${cajon ? 'w-72 h-full overflow-y-auto' : 'w-16 lg:w-56'} bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 transition-all duration-200`}>
      {/* Status dot */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-800">
        <span className={`w-2 h-2 rounded-full shrink-0 ${
          !backendReady ? 'bg-red-400 animate-pulse' : 'bg-emerald-400 animate-pulse-slow'
        }`} />
        <span className={`${L} text-xs truncate`}>
          {!backendReady
            ? <span className="text-slate-400">{t('sidebar.connecting')}</span>
            : <span className="text-slate-400">{t('sidebar.aiReady')}</span>}
        </span>
      </div>

      {/* Nav */}
      {/* En el cajón se desplaza el panel entero, no solo la lista: si no, los
          bloques de abajo la aprietan y Tutoriales queda escondido. */}
      <nav className={`${cajon ? 'flex-none' : 'flex-1 overflow-y-auto'} py-3 space-y-0.5 px-2`}>
        {navItems.map(({ to, Icon, color, emoji, label, group, children }) => group ? (
          <div key={group}>
            <button
              onClick={() => setEstudiarAbierto(a => !a)}
              title={label}
              className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-all duration-150"
            >
              <IconBadge icon={Icon} color={color} size="sm" />
              <span className={`${L} truncate flex-1 text-left`}>{label}</span>
              <IconChevronDown size={14} className={`${L} shrink-0 transition-transform duration-200 ${estudiarAbierto ? 'rotate-180' : ''}`} />
            </button>
            {estudiarAbierto && (
              <div className={`${cajon ? 'ml-4 pl-2 border-l' : 'lg:ml-4 lg:pl-2 lg:border-l'} border-slate-800 space-y-0.5 py-0.5`}>
                {children.map(c => (
                  <NavLink
                    key={c.to}
                    to={c.to}
                    onClick={alNavegar}
                    title={c.label}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all duration-150
                       ${isActive ? 'bg-primary-600/20 text-primary-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
                  >
                    <IconBadge icon={c.Icon} color={c.color} size="sm" />
                    <span className={`${L} truncate`}>{c.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ) : (
          <NavLink
            key={to}
            to={to}
            end={to === '/home'}
            onClick={alNavegar}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
               ${isActive
                 ? 'bg-primary-600/20 text-primary-300 border border-primary-700/50'
                 : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`
            }
          >
            <IconBadge icon={Icon} emoji={emoji} color={color} size="sm" />
            <span className={`${L} truncate`}>{label}</span>
            {/* Tooltip en modo estrecho */}
            <span className={`
              pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2
              px-2.5 py-1.5 rounded-lg
              bg-slate-800 border border-slate-600 shadow-xl
              text-xs text-slate-100 whitespace-nowrap
              opacity-0 group-hover:opacity-100
              transition-opacity duration-150
              z-50 ${TIP}
            `}>
              {label}
            </span>
          </NavLink>
        ))}

        <button
          onClick={() => setTutorialesAbierto(a => !a)}
          title={t('sidebar.tutorials')}
          className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-all duration-150"
        >
          <IconBadge icon={IconBook} color="slate" size="sm" />
          <span className={`${L} truncate flex-1 text-left`}>{t('sidebar.tutorials')}</span>
          <IconChevronDown size={14} className={`${L} shrink-0 transition-transform duration-200 ${tutorialesAbierto ? 'rotate-180' : ''}`} />
        </button>
        {/* Se despliega deslizando (grid 0fr → 1fr anima la altura real) y
            cada entrada aparece en cascada, un poco después de la anterior. */}
        <div className={`grid transition-[grid-template-rows] duration-500 ease-out ${tutorialesAbierto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className={`${cajon ? 'ml-4 pl-2 border-l' : 'lg:ml-4 lg:pl-2 lg:border-l'} border-slate-800 space-y-0.5 py-0.5`}>
              {tutoriales.map(({ to, Icon, emoji, color, label }, i) => (
                <button
                  key={to}
                  title={label}
                  tabIndex={tutorialesAbierto ? 0 : -1}
                  onClick={() => { alNavegar?.(); window.dispatchEvent(new CustomEvent('studyai:show-onboarding', { detail: { section: SECCION[to] } })) }}
                  style={{ transitionDelay: tutorialesAbierto ? `${i * 35}ms` : '0ms' }}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100
                              transition-all duration-300 ease-out
                              ${tutorialesAbierto ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3'}`}
                >
                  <IconBadge icon={Icon} emoji={emoji} color={color} size="sm" />
                  <span className={`${L} truncate`}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* El uso del ciclo (plan Free y presupuesto de voz Pro) vive solo en
          Inicio: aquí duplicaba y cargaba el menú. */}

      {/* Objetivo diario de estudio */}
      <div className="px-3 py-3 border-t border-slate-800">
        <div className={`${L}`}>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{t('sidebar.today')}</p>
          <p className="text-sm font-semibold text-emerald-400 mb-1.5">
            {todayStudyMinutes} / {dailyGoalMinutes} min
          </p>
          <ProgressBar value={todayStudyMinutes} max={dailyGoalMinutes} color="green" height="h-1.5" />
        </div>
      </div>

      {/* Botón Cerrar sesión */}
      {user && (
        <div className="px-2 py-2 border-t border-slate-800">
          <p className={`${L} text-[10px] text-slate-600 truncate px-2 mb-1`}>
            {displayName || user.email}
          </p>
          <button
            onClick={signOut}
            className="group relative w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium
                       text-slate-500 hover:bg-red-900/30 hover:text-red-400 transition-all duration-150"
          >
            <span className="shrink-0 w-6 flex items-center justify-center"><IconLogout size={18} stroke={1.8} /></span>
            <span className={`${L} truncate`}>{t('sidebar.signOut')}</span>
            <span className={`
              pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2
              px-2.5 py-1.5 rounded-lg
              bg-slate-800 border border-slate-600 shadow-xl
              text-xs text-slate-100 whitespace-nowrap
              opacity-0 group-hover:opacity-100
              transition-opacity duration-150
              z-50 ${TIP}
            `}>
              {t('sidebar.signOut')}
            </span>
          </button>
        </div>
      )}
    </aside>
  )
}
