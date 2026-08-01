import { useAppStore } from '../../store/appStore'

const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' }
const colors = {
  info:    'bg-slate-700 border-slate-600',
  success: 'bg-emerald-900/80 border-emerald-700',
  warning: 'bg-yellow-900/80 border-yellow-700',
  error:   'bg-red-900/80 border-red-700',
}

export default function ToastContainer() {
  const { toasts, removeToast } = useAppStore()
  if (!toasts.length) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`${colors[t.type]} border rounded-xl px-4 py-3 flex items-center gap-3 shadow-xl animate-slide-in`}
        >
          <span>{icons[t.type]}</span>
          <p className="text-sm flex-1 text-slate-100">{t.message}</p>
          <button onClick={() => removeToast(t.id)} className="text-slate-400 hover:text-slate-100 ml-1">✕</button>
        </div>
      ))}
    </div>
  )
}
