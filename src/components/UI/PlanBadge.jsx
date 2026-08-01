import { useAuth } from '../../contexts/AuthContext'
import { useAppStore } from '../../store/appStore'
import { getPlanTier } from '../../lib/plan'

// Insignia junto al logo: "Pro" en dorado durante los 7 días de prueba o con
// una cuenta marcada manualmente como pro (profiles.plan_override), "Free"
// en gris el resto. planTier viene del backend (Sidebar.jsx lo carga vía
// /usage/summary) — solo se usa el cálculo local como respaldo mientras carga.
export default function PlanBadge({ className = '' }) {
  const { user } = useAuth()
  const planTier = useAppStore(s => s.planTier)
  if (!user) return null

  const tier = planTier ?? getPlanTier(user)

  if (tier === 'trial' || tier === 'pro') {
    return (
      <span className={`text-[10px] font-bold uppercase tracking-wide bg-gradient-to-r from-amber-300 to-yellow-500 bg-clip-text text-transparent ${className}`}>
        Pro
      </span>
    )
  }

  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide text-slate-500 ${className}`}>
      Free
    </span>
  )
}
