import { useEffect, useState } from 'react'
import { api } from '../store/appStore'

/**
 * Región fiscal del usuario (Canarias -> IGIC, resto -> IVA/Stripe Tax),
 * guardada en profiles.settings.billing_canarias vía /me/settings -- así
 * vale para todas las compras futuras y en cualquier dispositivo, no solo
 * en el navegador donde se marcó.
 *
 * canarias: true | false | null (null = todavía no se le ha preguntado)
 */
export function useBillingRegion() {
  const [canarias, setCanariasState] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('GET', '/me/settings')
      .then(async (settings) => {
        if (typeof settings.billing_canarias === 'boolean') {
          setCanariasState(settings.billing_canarias)
          return
        }
        // Cuenta recién confirmada: si el registro dejó una respuesta
        // pendiente en este navegador, sincronizarla ahora que ya hay sesión.
        const pending = localStorage.getItem('billing_canarias_pending')
        if (pending === '0' || pending === '1') {
          const value = pending === '1'
          await api('PUT', '/me/settings', { billing_canarias: value })
          localStorage.removeItem('billing_canarias_pending')
          setCanariasState(value)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function setCanarias(value) {
    setCanariasState(value)
    await api('PUT', '/me/settings', { billing_canarias: value })
  }

  return { canarias, loading, setCanarias }
}
