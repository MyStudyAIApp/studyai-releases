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

// Aplicar la plantilla visual guardada ANTES de que React monte, para que no
// haya un parpadeo con los colores por defecto al cargar.
applyTheme(getTheme())

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
