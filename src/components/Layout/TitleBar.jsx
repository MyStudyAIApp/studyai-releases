import { version } from '../../../package.json'
import Logo from '../UI/Logo'
import PlanBadge from '../UI/PlanBadge'

export default function TitleBar() {
  const isElectron = !!window.electron

  return (
    <div className="titlebar-drag h-10 bg-slate-950 border-b border-slate-800 flex items-center px-4 shrink-0 select-none">
      {/* Logo — izquierda */}
      <div className="flex items-center gap-2 flex-1">
        <Logo size="md" />
        <PlanBadge />
        <span className="badge-blue text-[10px]">v{version}</span>
      </div>

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
