import { useState, useEffect, useRef } from 'react'

/**
 * WhisperSetup — pantalla modal que aparece la primera vez que el usuario abre
 * la app sin tener el modelo Whisper instalado.
 *
 * También se puede usar desde Ajustes pasando `embedded={true}`, en cuyo caso
 * no ocupa toda la pantalla sino que se renderiza inline.
 *
 * Props:
 *   onDismiss   — función llamada cuando el usuario cierra / termina
 *   embedded    — si es true, no muestra el overlay oscuro ni el title-bar falso
 */
export default function WhisperSetup({ onDismiss, embedded = false }) {
  // idle | downloading | done | error | cancelled
  const [phase, setPhase]       = useState('idle')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  const unsubRefs = useRef([])

  // Al montar: comprobar si ya hay una descarga activa (el usuario navegó fuera y volvió)
  useEffect(() => {
    const api = window.electron?.whisper
    if (!api) return
    api.isDownloading?.().then(active => {
      if (active) setPhase('downloading')
    }).catch(() => {})
  }, [])

  // Suscribir a los eventos IPC del proceso principal
  useEffect(() => {
    const api = window.electron?.whisper
    if (!api) return

    const unsubProgress = api.onProgress((pct) => {
      setProgress(pct)
      setPhase('downloading')
    })
    const unsubDone = api.onDone(() => {
      setProgress(100)
      setPhase('done')
    })
    const unsubError = api.onError((msg) => {
      if (msg === 'cancelled') {
        setPhase('cancelled')
      } else {
        setErrorMsg(msg)
        setPhase('error')
      }
    })

    unsubRefs.current = [unsubProgress, unsubDone, unsubError]
    return () => unsubRefs.current.forEach(fn => fn?.())
  }, [])

  const handleDownload = () => {
    setPhase('downloading')
    setProgress(0)
    setErrorMsg('')
    window.electron?.whisper?.download()
  }

  const handleCancel = () => {
    window.electron?.whisper?.cancel()
    setPhase('idle')
    setProgress(0)
  }

  const handleSkip = () => {
    // Marcar que el usuario ya eligió posponer — no volver a mostrar al arrancar
    localStorage.setItem('studyai-whisper-postponed', '1')
    onDismiss?.()
  }

  const handleClose = () => {
    if (phase === 'downloading') handleCancel()
    onDismiss?.()
  }

  // ── Contenido ─────────────────────────────────────────────────────────────
  const content = (
    <div className={`${embedded ? '' : 'bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4'}`}>

      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-4xl">🎤</span>
        <div>
          <h2 className="text-xl font-bold text-slate-100">Reconocimiento de voz (Whisper)</h2>
          <p className="text-sm text-slate-400">Motor de transcripción de audio</p>
        </div>
      </div>

      {/* Explicación */}
      <div className="bg-slate-700/50 rounded-xl p-4 mb-5 border border-slate-600/50">
        <p className="text-sm text-slate-200 leading-relaxed mb-3">
          <strong className="text-slate-100">¿Qué es Whisper?</strong> Es el motor que convierte
          tu voz en texto dentro de MyStudy AI. Funciona completamente offline —
          tu audio nunca sale de tu ordenador.
        </p>
        <p className="text-sm text-slate-300 leading-relaxed mb-3">
          Lo usan funciones como:
        </p>
        <ul className="text-sm text-slate-300 space-y-1 ml-3">
          <li>🎙️ <strong>Dictar apuntes</strong> — habla y MyStudy AI escribe</li>
          <li>📹 <strong>Transcribir vídeos</strong> — extrae el texto de cualquier vídeo</li>
          <li>📚 <strong>Clases en audio</strong> — convierte grabaciones en apuntes</li>
          <li>🗣️ <strong>Tutor por voz</strong> — habla con el tutor inteligente</li>
        </ul>
        <p className="text-sm text-amber-300 mt-3 font-medium">
          ⚠️ Es fundamental tenerlo instalado para el correcto funcionamiento de
          todas las funciones de voz y transcripción.
        </p>
      </div>

      {/* Tamaño */}
      <p className="text-xs text-slate-500 mb-5">
        Tamaño de descarga: <strong className="text-slate-400">~1,4 GB</strong> · Se descarga una sola vez · No requiere internet para usarse
      </p>

      {/* Estado: descargando */}
      {phase === 'downloading' && (
        <div className="mb-5">
          <div className="flex justify-between text-sm text-slate-300 mb-2">
            <span>Descargando modelo Whisper...</span>
            <span className="font-mono font-semibold text-slate-100">{progress}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-violet-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Puedes cerrar esta ventana — la descarga continúa en segundo plano.
            Comprueba el progreso desde <em>Ajustes → Whisper</em>.
          </p>
        </div>
      )}

      {/* Estado: listo */}
      {phase === 'done' && (
        <div className="mb-5 flex items-center gap-3 bg-emerald-900/40 border border-emerald-700/50 rounded-xl p-4">
          <span className="text-2xl">✅</span>
          <div>
            <p className="text-sm font-semibold text-emerald-300">¡Whisper instalado correctamente!</p>
            <p className="text-xs text-emerald-400/80 mt-0.5">Ya puedes usar todas las funciones de voz y transcripción.</p>
          </div>
        </div>
      )}

      {/* Estado: error */}
      {phase === 'error' && (
        <div className="mb-5 bg-red-900/40 border border-red-700/50 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-300 mb-1">Error al descargar</p>
          <p className="text-xs text-red-400/80 font-mono break-all">{errorMsg}</p>
          <p className="text-xs text-slate-400 mt-2">
            Comprueba tu conexión a internet e inténtalo de nuevo.
          </p>
        </div>
      )}

      {/* Botones */}
      <div className="flex gap-3 flex-wrap">
        {phase === 'idle' && (
          <>
            <button
              onClick={handleDownload}
              className="flex-1 min-w-[160px] bg-primary-600 hover:bg-primary-500 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm"
            >
              Descargar ahora (~1,4 GB)
            </button>
            {!embedded && (
              <button
                onClick={handleSkip}
                className="text-sm text-slate-400 hover:text-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-700 transition-colors"
              >
                Instalar después
              </button>
            )}
          </>
        )}

        {phase === 'downloading' && (
          <button
            onClick={handleCancel}
            className="text-sm text-slate-400 hover:text-red-300 px-4 py-2.5 rounded-xl hover:bg-slate-700 transition-colors"
          >
            Cancelar descarga
          </button>
        )}

        {(phase === 'done' || phase === 'cancelled') && (
          <button
            onClick={handleClose}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm"
          >
            {phase === 'done' ? 'Continuar' : 'Cerrar'}
          </button>
        )}

        {phase === 'error' && (
          <>
            <button
              onClick={handleDownload}
              className="flex-1 bg-primary-600 hover:bg-primary-500 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm"
            >
              Reintentar
            </button>
            {!embedded && (
              <button
                onClick={handleSkip}
                className="text-sm text-slate-400 hover:text-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-700 transition-colors"
              >
                Más tarde
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )

  // ── Modo embebido (dentro de Ajustes) ─────────────────────────────────────
  if (embedded) return content

  // ── Modo overlay (primer arranque) ────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Barra de título falsa (la ventana es frameless) */}
      <div
        className="h-8 bg-slate-900 flex-shrink-0 select-none"
        style={{ WebkitAppRegion: 'drag' }}
      />

      {/* Overlay oscuro con el diálogo centrado */}
      <div className="flex-1 bg-slate-900/95 flex items-center justify-center">
        {content}
      </div>
    </div>
  )
}
