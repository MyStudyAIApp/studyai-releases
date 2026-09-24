import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import { verFuncion } from '../../lib/betaFlags'
import {
  IconHome, IconBooks, IconNotebook, IconBrain, IconFileText, IconWorld, IconMicrophone2,
  IconCalculator, IconScale, IconChartBar, IconCalendar, IconSettings,
  IconMenu2, IconX, IconLogout,
} from '@tabler/icons-react'

// Barra inferior para MyStudy App (web cargada en móvil) — el Sidebar de
// escritorio (columna fija de iconos) no cabe bien en pantallas estrechas.
// label = clave de sidebar.* en i18n.
// Solo las 5 secciones más usadas van fijas abajo; el resto vive en "Más".
const PRIMARY = [
  { to: '/home',    Icon: IconHome,  label: 'home' },
  { to: '/library', Icon: IconBooks, label: 'library' },
  { to: '/cuaderno', Icon: IconNotebook, label: 'notebook' },
  { to: '/study',   Icon: IconBrain, label: 'study' },
  { to: '/exam',    Icon: IconFileText, label: 'exam' },
]

const MORE_ITEMS = [
  // 'beta' = solo se pinta si lib/betaFlags deja ver esa funcion a este usuario
  { to: '/tutor',     emoji: '🦉', label: 'tutor' },
  { to: '/languages', Icon: IconWorld,       label: 'languages' },
  { to: '/lecture',   Icon: IconMicrophone2, label: 'lecture' },
  { to: '/solve',     Icon: IconCalculator,  label: 'solveExercise' },
  { to: '/compare',   Icon: IconScale,       label: 'compare' },
  { to: '/stats',     Icon: IconChartBar,    label: 'stats' },
  { to: '/calendar',  Icon: IconCalendar,    label: 'calendar' },
  { to: '/settings',  Icon: IconSettings,    label: 'settings' },
]

export default function MobileBottomNav() {
  const { t } = useTranslation()
  const { signOut, user } = useAuth()
  const navigate = useNavigate()
  const [showMore, setShowMore] = useState(false)

  return (
    <>
      <nav className="shrink-0 bg-slate-950 border-t border-slate-800 flex items-stretch pb-[env(safe-area-inset-bottom)]">
        {PRIMARY.map(({ to, Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/home'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium
               ${isActive ? 'text-primary-400' : 'text-slate-500'}`
            }
          >
            <Icon size={20} />
            {t(`sidebar.${label}`)}
          </NavLink>
        ))}
        <button
          onClick={() => setShowMore(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-slate-500"
        >
          <IconMenu2 size={20} />
          {t('sidebar.more')}
        </button>
      </nav>

      {showMore && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowMore(false)} />
          <div className="relative bg-slate-900 rounded-t-3xl overflow-hidden max-h-[75vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 shrink-0">
              <span className="font-semibold text-slate-100">{t('sidebar.moreSections')}</span>
              <button onClick={() => setShowMore(false)} className="text-slate-400 leading-none"><IconX size={20} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-3 grid grid-cols-3 gap-2">
              {MORE_ITEMS.filter(i => !i.beta || verFuncion(i.beta, user)).map(({ to, Icon, emoji, label }) => (
                <button
                  key={to}
                  onClick={() => { setShowMore(false); navigate(to) }}
                  className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl bg-slate-800 active:bg-slate-700 text-slate-200"
                >
                  <span className="text-2xl leading-none">
                    {emoji || <Icon size={22} />}
                  </span>
                  <span className="text-[11px] text-center leading-tight">{t(`sidebar.${label}`)}</span>
                </button>
              ))}
              <button
                onClick={() => { setShowMore(false); signOut() }}
                className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl bg-slate-800 active:bg-red-900/40 text-red-400"
              >
                <IconLogout size={22} />
                <span className="text-[11px]">{t('sidebar.signOut')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
