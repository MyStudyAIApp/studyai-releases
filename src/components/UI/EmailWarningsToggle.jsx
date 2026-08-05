import { useState, useEffect } from 'react'
import { api } from '../../store/appStore'

// Interruptor compartido entre la Biblioteca (aviso de retención de PDFs) y
// "Resolver ejercicio" (aviso de retención de ejercicios) — es el mismo
// ajuste en el servidor (GET /me → email_warnings_enabled, POST
// /me/set-email-warnings), así que se ve y se comporta igual en los dos
// sitios: tocarlo en uno afecta también al otro.
export default function EmailWarningsToggle({ className = '' }) {
  const [enabled, setEnabled] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('GET', '/me').then(me => setEnabled(me.email_warnings_enabled !== false)).catch(() => {})
  }, [])

  async function toggle() {
    const next = !enabled
    setEnabled(next)  // optimista
    setBusy(true)
    try {
      await api('POST', '/me/set-email-warnings', { enabled: next })
    } catch {
      setEnabled(!next)  // revertir si falla
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`flex items-center gap-2 text-[11px] text-slate-400 hover:text-slate-300 transition-colors disabled:opacity-50 ${className}`}
      title="Avisos por email 3 días antes de que se borre un PDF o un ejercicio"
    >
      <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-primary-600' : 'bg-slate-600'}`}>
        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
      </span>
      Avisarme por email antes de borrar algo
    </button>
  )
}
