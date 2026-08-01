import { useNavigate, useLocation } from 'react-router-dom'
import { IconHome, IconBooks, IconCalendar, IconSettings } from '@tabler/icons-react'

const TABS = [
  { path: '/',         Icon: IconHome,     label: 'Inicio'    },
  { path: '/library',  Icon: IconBooks,    label: 'Biblioteca' },
  { path: '/exams',    Icon: IconCalendar, label: 'Exámenes'  },
  { path: '/settings', Icon: IconSettings, label: 'Ajustes'   },
]

export default function MobileTabBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-50 flex items-stretch"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map(tab => {
        const active = pathname === tab.path
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors
              ${active ? 'text-primary-400' : 'text-slate-500 active:text-slate-300'}`}
          >
            <tab.Icon size={22} stroke={1.8} />
            <span className={`text-[10px] font-medium tracking-tight
              ${active ? 'text-primary-400' : 'text-slate-500'}`}>
              {tab.label}
            </span>
            {active && (
              <span className="absolute bottom-0 w-8 h-0.5 bg-primary-500 rounded-full"
                style={{ bottom: 'calc(env(safe-area-inset-bottom))' }} />
            )}
          </button>
        )
      })}
    </nav>
  )
}
