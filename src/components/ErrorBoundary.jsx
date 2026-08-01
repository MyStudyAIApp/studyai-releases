import { Component } from 'react'
import * as Sentry from '@sentry/react'

/**
 * Error Boundary — captura errores de React que de otro modo dejarían
 * la pantalla en azul. Muestra un mensaje amigable al usuario y envía
 * el error técnico a Sentry silenciosamente.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, errorInfo: null, showDetails: false }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo })
    // Enviar a Sentry silenciosamente
    Sentry.captureException(error, {
      extra: { componentStack: errorInfo?.componentStack },
    })
    // Log interno para backend.log
    console.error('[ErrorBoundary] React error caught:', error)
    console.error('[ErrorBoundary] Component stack:', errorInfo?.componentStack)
  }

  handleCopyDetails() {
    const { error, errorInfo } = this.state
    const text = [
      `Error: ${error?.name}: ${error?.message}`,
      '',
      'Stack:',
      error?.stack,
      '',
      'Componente:',
      errorInfo?.componentStack,
    ].join('\n')
    // En Electron, navigator.clipboard no funciona sin permisos especiales
    // → usamos el clipboard nativo vía IPC
    if (window.electron?.clipboard?.write) {
      window.electron.clipboard.write(text)
    } else {
      navigator.clipboard?.writeText(text).catch(() => {})
    }
  }

  render() {
    if (this.state.error) {
      const { error, errorInfo, showDetails } = this.state
      return (
        <div style={{
          position: 'fixed', inset: 0,
          background: '#0f172a',
          color: '#f1f5f9',
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          WebkitAppRegion: 'no-drag',
          zIndex: 99999,
        }}>
          {/* Barra de título para mover/cerrar la ventana */}
          <div style={{
            height: '32px',
            background: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            flexShrink: 0,
            WebkitAppRegion: 'drag',
          }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>MyStudy AI</span>
            <button
              onClick={() => window.electron?.window?.close?.()}
              style={{
                background: '#ef4444', border: 'none', color: 'white',
                width: '20px', height: '20px', borderRadius: '50%',
                cursor: 'pointer', fontSize: '12px',
                WebkitAppRegion: 'no-drag',
              }}
            >×</button>
          </div>

          {/* Contenido central */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>😵</div>

            <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px', color: '#f1f5f9' }}>
              Algo ha ido mal
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '15px', marginBottom: '32px', maxWidth: '420px', lineHeight: '1.6' }}>
              La aplicación ha encontrado un error inesperado.
              El equipo de MyStudy AI ya ha sido notificado automáticamente.
            </p>

            {/* Botones principales */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <button
                onClick={() => this.setState({ error: null, errorInfo: null, showDetails: false })}
                style={{
                  background: '#3b82f6', border: 'none', color: 'white',
                  padding: '10px 24px', borderRadius: '8px',
                  cursor: 'pointer', fontSize: '14px', fontWeight: '600',
                }}
              >
                Reintentar
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: '#475569', border: 'none', color: 'white',
                  padding: '10px 24px', borderRadius: '8px',
                  cursor: 'pointer', fontSize: '14px',
                }}
              >
                Recargar app
              </button>
            </div>

            {/* Enlace discreto para ver detalles técnicos (para soporte) */}
            <button
              onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
              style={{
                background: 'none', border: 'none', color: '#475569',
                fontSize: '12px', cursor: 'pointer', textDecoration: 'underline',
              }}
            >
              {showDetails ? 'Ocultar detalles técnicos' : 'Ver detalles técnicos (soporte)'}
            </button>

            {/* Detalles técnicos — solo si el usuario los pide explícitamente */}
            {showDetails && (
              <div style={{
                marginTop: '16px',
                background: '#1e293b',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'left',
                width: '100%',
                maxWidth: '600px',
                maxHeight: '200px',
                overflowY: 'auto',
                border: '1px solid #334155',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ color: '#fca5a5', fontSize: '12px', fontFamily: 'monospace' }}>
                    {error?.name}: {error?.message}
                  </span>
                  <button
                    onClick={() => this.handleCopyDetails()}
                    style={{
                      background: '#334155', border: 'none', color: '#94a3b8',
                      padding: '2px 8px', borderRadius: '4px',
                      cursor: 'pointer', fontSize: '11px', flexShrink: 0, marginLeft: '8px',
                    }}
                  >
                    Copiar
                  </button>
                </div>
                <pre style={{
                  color: '#64748b', fontSize: '10px',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  margin: 0,
                }}>
                  {error?.stack}
                </pre>
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
