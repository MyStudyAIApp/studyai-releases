import { useTranslation } from 'react-i18next'
import { version } from '../../../package.json'
import Logo from '../UI/Logo'
import PlanBadge from '../UI/PlanBadge'
import { useAuth } from '../../contexts/AuthContext'

export default function TitleBar() {
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
        <Logo size="md" />
        <PlanBadge />
        <span className="badge-blue text-[10px]">v{version}</span>
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
