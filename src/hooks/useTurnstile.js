import { useEffect, useRef, useState } from 'react'
import { IS_ELECTRON } from '../store/appStore'

// Widget "mystudyai-registro" en Cloudflare Turnstile — protección anti-bot
// verificada por Supabase Auth (Attack Protection) con el secret key, nunca
// en el frontend. Supabase la exige en TODAS las pantallas de login/registro:
// si una no manda captchaToken, Supabase la rechaza con "captcha protection:
// request disallowed (no captcha_token found)". Por eso vive aquí y no
// duplicada en cada pantalla — hay dos (LoginPage y MobileLoginPage) y tener
// el widget solo en una es justo el bug que rompió MyStudy Scan (19/8/2026).
//
// Activo en web y en las apps móviles (Capacitor sirve el WebView desde
// https://localhost, un origen real que Turnstile sí valida — "localhost"
// está añadido como dominio permitido del widget). NO en Electron: ahí el
// WebView carga vía file://, sin origen https, Turnstile no puede validar.
const TURNSTILE_SITE_KEY = '0x4AAAAAAEVQhAal_1_-KEtW'

// `active` permite apagarlo cuando la pantalla no muestra el formulario
// (ej. LoginPage en modo 'sent'/'confirmed'), liberando el widget.
export function useTurnstile(active = true) {
  const [token, setToken] = useState('')
  const containerRef = useRef(null)
  const widgetId = useRef(null)
  const enabled = !IS_ELECTRON && active

  // Cargar el script de Cloudflare una sola vez
  useEffect(() => {
    if (!enabled || window.turnstile || document.getElementById('turnstile-script')) return
    const script = document.createElement('script')
    script.id = 'turnstile-script'
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    document.head.appendChild(script)
  }, [enabled])

  // Renderizar el widget en cuanto el script esté disponible, quitarlo al salir
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const tryRender = () => {
      if (cancelled || !containerRef.current) return
      if (window.turnstile && widgetId.current === null) {
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (t) => setToken(t),
          'expired-callback': () => setToken(''),
          'error-callback': () => setToken(''),
        })
      } else if (!window.turnstile) {
        setTimeout(tryRender, 200)
      }
    }
    tryRender()
    return () => {
      cancelled = true
      if (window.turnstile && widgetId.current !== null) {
        window.turnstile.remove(widgetId.current)
        widgetId.current = null
      }
      setToken('')
    }
  }, [enabled])

  // Los tokens son de un solo uso: tras un intento fallido hay que pedir otro
  const reset = () => {
    if (window.turnstile && widgetId.current !== null) {
      window.turnstile.reset(widgetId.current)
      setToken('')
    }
  }

  return { containerRef, token, enabled, reset }
}
