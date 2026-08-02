import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter as BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './styles/index.css'
import './styles/print.css'
import './i18n'
import { getTheme, applyTheme } from './services/themeService'
import { IS_ELECTRON } from './store/appStore'

// Aplicar la plantilla visual guardada ANTES de que React monte, para que no
// haya un parpadeo con los colores por defecto al cargar.
applyTheme(getTheme())

// Widget de cookies (iubenda) — SOLO en web. En el escritorio empaquetado,
// cualquier script cargado en este renderer comparte el mismo proceso que
// tiene el preload de Electron adjunto (shell.openExternal, token local,
// etc.) — no tiene sentido darle ese acceso a un script de terceros que la
// app ni siquiera necesita ahí (el escritorio no muestra banner de cookies).
if (!IS_ELECTRON) {
  const iubenda = document.createElement('script')
  iubenda.src = 'https://embeds.iubenda.com/widgets/29cceca0-2254-430d-9a68-ed620d4ad100.js'
  document.head.appendChild(iubenda)
}

// ── Polyfill URL.parse ────────────────────────────────────────────────────────
// URL.parse() es un método estático nuevo (Chrome 126+).
// Electron 28 trae Chrome 120 → no existe → pdfjs-dist 4.x crashea al usarlo.
// Polyfill: devuelve URL object si válido, null si inválido (igual que el nativo).
if (typeof URL.parse === 'undefined') {
  URL.parse = (url, base) => {
    try { return new URL(url, base) } catch { return null }
  }
}

// ── Sentry — registro de errores en producción ────────────────────────────────
Sentry.init({
  dsn: 'https://093b576ae52bb87a58ddf5603a311518@o4511526266863616.ingest.de.sentry.io/4511526288752720',
  environment: import.meta.env.DEV ? 'development' : 'production',
  enabled: !import.meta.env.DEV,   // solo activo en producción
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
  tracesSampleRate: 0.1,           // registra el 10% de las navegaciones (rendimiento)
  sendDefaultPii: false,           // no enviar datos personales por defecto
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
