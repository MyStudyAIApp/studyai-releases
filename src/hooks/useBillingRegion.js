import { useEffect, useState } from 'react'
import { api } from '../store/appStore'

/**
 * Región fiscal del usuario -- 'canarias' (IGIC), 'ceuta_melilla' (IPSI) o
 * 'resto' (IVA/Stripe Tax) -- guardada en profiles.settings.billing_region
 * vía /me/settings -- así vale para todas las compras futuras y en
 * cualquier dispositivo, no solo en el navegador donde se marcó.
 *
 * region: 'canarias' | 'ceuta_melilla' | 'resto' | null (aún no preguntado)
 */
export function useBillingRegion() {
  const [region, setRegionState] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('GET', '/me/settings')
      .then(async (settings) => {
        if (settings.billing_region) {
          setRegionState(settings.billing_region)
          return
        }
        // Cuenta recién confirmada: si el registro dejó una respuesta
        // pendiente en este navegador, sincronizarla ahora que ya hay sesión.
        const pending = localStorage.getItem('billing_region_pending')
        if (pending) {
          await api('PUT', '/me/settings', { billing_region: pending })
          localStorage.removeItem('billing_region_pending')
          setRegionState(pending)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function setRegion(value) {
    setRegionState(value)
    await api('PUT', '/me/settings', { billing_region: value })
  }

  return { region, loading, setRegion }
}
