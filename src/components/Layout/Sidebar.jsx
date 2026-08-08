import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAppStore, IS_WEB, api } from '../../store/appStore'
import { useAuth } from '../../contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import { getPlanTier } from '../../lib/plan'
import {
  IconHome, IconBooks, IconBrain, IconFileText, IconWorld, IconMicrophone2,
  IconCalculator, IconScale, IconChartBar, IconCalendar, IconSettings, IconCloud,
  IconLogout,
} from '@tabler/icons-react'
import ProgressBar from '../UI/ProgressBar'
import IconBadge from '../UI/IconBadge'

export default function Sidebar() {
  const { t } = useTranslation()
  const { backendReady, todayStudyMinutes, dailyGoalMinutes, planTier, setPlanTier } = useAppStore()
  const { user, signOut, loading: authLoading } = useAuth()
  const [usage, setUsage] = useState(null)
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
    api('GET', '/usage/summary').then(data => { setUsage(data); setPlanTier(data.tier) }).catch(() => {})
  }, [backendReady, authLoading])

  const isFree = (planTier ?? getPlanTier(user)) === 'free'

  // Tutor conserva su mascota 🦉 (emoji), pero dentro de la misma insignia
  // circular que el resto — si no, se ve "plana" al lado de los iconos nuevos.
  const navItems = [
    { to: '/home',      Icon: IconHome,        color: 'blue',   label: t('sidebar.home') },
    { to: '/library',   Icon: IconBooks,       color: 'purple', label: t('sidebar.library') },
    { to: '/study',     Icon: IconBrain,       color: 'green',  label: t('sidebar.study') },
    { to: '/exam',      Icon: IconFileText,    color: 'amber',  label: t('sidebar.exam') },
    { to: '/tutor',     emoji: '🦉', color: 'purple', label: t('sidebar.tutor') },
    { to: '/languages', Icon: IconWorld,       color: 'teal',   label: t('sidebar.languages') },
    { to: '/lecture',   Icon: IconMicrophone2, color: 'pink',   label: t('sidebar.lecture') },
    { to: '/solve',     Icon: IconCalculator,  color: 'blue',   label: t('sidebar.solveExercise') },
    { to: '/compare',   Icon: IconScale,       color: 'purple', label: t('sidebar.compare') },
    { to: '/stats',     Icon: IconChartBar,    color: 'green',  label: t('sidebar.stats') },
    { to: '/calendar',  Icon: IconCalendar,    color: 'amber',  label: t('sidebar.calendar') },
    { to: '/settings',  Icon: IconSettings,    color: 'slate',  label: t('sidebar.settings') },
    ...(!IS_WEB ? [{ to: '/sync', Icon: IconCloud, color: 'blue', label: 'Sincronizar' }] : []),
  ]

  return (
    <aside className="w-16 lg:w-56 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 transition-all duration-200">
      {/* Status dot */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-800">
        <span className={`w-2 h-2 rounded-full shrink-0 ${
          !backendReady ? 'bg-red-400 animate-pulse' : 'bg-emerald-400 animate-pulse-slow'
        }`} />
        <span className="hidden lg:block text-xs truncate">
          {!backendReady
            ? <span className="text-slate-400">{t('sidebar.connecting')}</span>
            : <span className="text-slate-400">{t('sidebar.aiReady')}</span>}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {navItems.map(({ to, Icon, color, emoji, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/home'}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
               ${isActive
                 ? 'bg-primary-600/20 text-primary-300 border border-primary-700/50'
                 : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`
            }
          >
            <IconBadge icon={Icon} emoji={emoji} color={color} size="sm" />
            <span className="hidden lg:block truncate">{label}</span>
            {/* Tooltip en modo estrecho */}
            <span className="
              pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2
              px-2.5 py-1.5 rounded-lg
              bg-slate-800 border border-slate-600 shadow-xl
              text-xs text-slate-100 whitespace-nowrap
              opacity-0 group-hover:opacity-100
              transition-opacity duration-150
              z-50 lg:hidden
            ">
              {label}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* Uso del plan Free (cupo real de los últimos 30 días) */}
      {isFree && usage && (
        <div className="hidden lg:block px-3 py-3 border-t border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Plan Free · últimos 30 días</p>
          <div className="space-y-1.5">
            {[
              { label: 'Generaciones', used: usage.generations_used, max: usage.generations_max },
              { label: 'Voz / visión (min)', used: usage.voice_minutes_used, max: usage.voice_minutes_max },
            ].map(({ label, used, max }) => (
              <div key={label}>
                <div className="flex items-center justify-between text-[11px] mb-0.5">
                  <span className="text-slate-400">{label}</span>
                  <span className={used >= max ? 'text-amber-400 font-semibold' : 'text-slate-400'}>{used}/{max}</span>
                </div>
                <ProgressBar value={used} max={max} color={used >= max ? 'yellow' : 'primary'} height="h-1" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Presupuesto de voz (transcripción + podcasts) -- SOLO Pro. Un Free
          nunca se acerca a este tope de verdad (le para antes el límite de
          minutos, mucho más bajo), así que mostrárselo sería ruido/confusión
          sin ningún uso real. Nunca se muestra en euros, solo el % ya
          calculado por el backend. */}
      {planTier === 'pro' && usage?.voice_budget && (
        <div className="hidden lg:block px-3 py-3 border-t border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Uso de voz este mes</p>
          <div className="space-y-1.5">
            {[
              { label: '🎙️ Transcripción', pct: usage.voice_budget.transcription?.spent_pct ?? 0 },
              { label: '🎧 Podcasts', pct: usage.voice_budget.podcast?.spent_pct ?? 0 },
            ].map(({ label, pct }) => (
              <div key={label}>
                <div className="flex items-center justify-between text-[11px] mb-0.5">
                  <span className="text-slate-400">{label}</span>
                  <span className={pct >= 90 ? 'text-amber-400 font-semibold' : 'text-slate-400'}>{pct}%</span>
                </div>
                <ProgressBar value={pct} max={100} color={pct >= 90 ? 'yellow' : 'primary'} height="h-1" />
              </div>
            ))}
          </div>
          {(usage.voice_budget.transcription?.spent_pct >= 90 || usage.voice_budget.podcast?.spent_pct >= 90) && (
            <p className="text-[11px] text-amber-400 mt-2">
              Te estás quedando sin cupo de voz este mes.{' '}
              <a href="mailto:soporte@mystudyai.eu" className="underline hover:text-amber-300">Escríbenos</a> para ampliarlo.
            </p>
          )}
        </div>
      )}

      {/* Objetivo diario de estudio */}
      <div className="px-3 py-3 border-t border-slate-800">
        <div className="hidden lg:block">
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
          <p className="hidden lg:block text-[10px] text-slate-600 truncate px-2 mb-1">
            {displayName || user.email}
          </p>
          <button
            onClick={signOut}
            className="group relative w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium
                       text-slate-500 hover:bg-red-900/30 hover:text-red-400 transition-all duration-150"
          >
            <span className="shrink-0 w-6 flex items-center justify-center"><IconLogout size={18} stroke={1.8} /></span>
            <span className="hidden lg:block truncate">{t('sidebar.signOut')}</span>
            <span className="
              pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2
              px-2.5 py-1.5 rounded-lg
              bg-slate-800 border border-slate-600 shadow-xl
              text-xs text-slate-100 whitespace-nowrap
              opacity-0 group-hover:opacity-100
              transition-opacity duration-150
              z-50 lg:hidden
            ">
              {t('sidebar.signOut')}
            </span>
          </button>
        </div>
      )}
    </aside>
  )
}
