import { useTranslation } from 'react-i18next'
import { IconMenu2 } from '@tabler/icons-react'
import Logo from '../UI/Logo'
import PlanBadge from '../UI/PlanBadge'
import { useAuth } from '../../contexts/AuthContext'
import { IS_MOBILE } from '../../store/appStore'
import OtraAppBoton from '../UI/OtraAppBoton'

const ES_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// onMenu: en móvil, botón ☰ que abre el cajón lateral (ver Layout.jsx)
export default function TitleBar({ onMenu }) {
  const { t } = useTranslation()
  const isElectron = !!window.electron
  const { user } = useAuth()
  // user_metadata.full_name -- misma fuente que edita Ajustes (supabase.auth.updateUser).
  // Antes se leía profiles.display_name vía /me, una columna aparte que solo
  // se rellena al registrarse y nunca se actualiza después -- por eso el
  // nombre editado en Ajustes no se reflejaba aquí.
  const displayName = user?.user_metadata?.full_name || null

  return (
    <div className="titlebar-drag h-10 bg-slate-950 border-b border-slate-800 flex items-center px-4 shrink-0 select-none">
      {/* Logo — izquierda */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {onMenu && (
          <button onClick={onMenu} aria-label={t('sidebar.more')}
                  className="-ml-2 mr-1 p-2 text-slate-300 active:text-white">
            <IconMenu2 size={22} />
          </button>
        )}
        <Logo size="md" />
        <PlanBadge />
      </div>

      {/* Cuenta activa — para distinguir a simple vista si se ha entrado con
          la cuenta equivocada (confusión real detectada en pruebas de QA).
          Nombre en vez de email por privacidad frente a miradas indiscretas
          (ej. compartir pantalla) -- cae al email solo si no hay nombre guardado. */}
      {(displayName || user?.email) && (
        <span className="hidden sm:block text-[10px] text-slate-500 truncate max-w-[220px] mr-2">
          {t('home.welcome', { name: displayName || user.email })}
        </span>
      )}

      {/* Controles — derecha */}
      <div className="titlebar-no-drag flex items-center">
        {/* Apps de Android: en la App, la otra (Scan); en la web, las dos
            para que se sepa que existen (en iPhone no, no hay app de iOS) */}
        {IS_MOBILE && <OtraAppBoton destino="scan" />}
        {!isElectron && !IS_MOBILE && !ES_IOS && <><OtraAppBoton destino="app" /><OtraAppBoton destino="scan" /></>}
        {isElectron && (
          <>
            <button
              onClick={() => window.electron.window.minimize()}
              className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors text-sm"
              title="Minimizar"
            >─</button>
            <button
              onClick={() => window.electron.window.maximize()}
              className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors text-xs"
              title="Maximizar"
            >□</button>
            <button
              onClick={() => window.electron.window.close()}
              className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-white hover:bg-red-600 transition-colors text-sm"
              title="Cerrar"
            >✕</button>
          </>
        )}
      </div>
    </div>
  )
}
