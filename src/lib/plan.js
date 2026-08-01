/**
 * Estado del plan del usuario — de momento solo distingue entre
 * "prueba gratis" (7 días desde el registro, acceso completo tipo Pro)
 * y "free" (pasados esos 7 días). El plan de pago real (Stripe) todavía
 * no existe — cuando se construya, este archivo es el sitio para añadir
 * el caso 'pro' de verdad.
 */
const TRIAL_DAYS = 7

export function getPlanTier(user) {
  if (!user?.created_at) return 'free'
  const createdAt = new Date(user.created_at).getTime()
  const daysSinceSignup = (Date.now() - createdAt) / (1000 * 60 * 60 * 24)
  return daysSinceSignup < TRIAL_DAYS ? 'trial' : 'free'
}
