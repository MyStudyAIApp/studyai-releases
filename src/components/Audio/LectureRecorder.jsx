import { useState, useRef, useEffect } from 'react'
import { useAppStore, api, apiUpload, IS_ELECTRON } from '../../store/appStore'

// Pipeline: Audio → Whisper (transcribe todo) → LLM (limpia, opcional) → LLM (resume)

export default function LectureRecorder({ subjectId, onTranscriptionSaved }) {
  const { addToast } = useAppStore()
  const [state, setState] = useState('idle') // idle | connecting | recording | transcribing | cleaning | summarizing | done
  const [duration, setDuration] = useState(0)
  const [rawTranscript, setRawTranscript] = useState('')
  const [cleanTranscript, setCleanTranscript] = useState('')
  const [summary, setSummary] = useState('')
  const [topic, setTopic] = useState('')
  const [removedCount, setRemovedCount] = useState(0)
  const [title, setTitle] = useState('')
  const [showRaw, setShowRaw] = useState(false)
  const [limpiarRuido, setLimpiarRuido] = useState(true)
  const mediaRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const canvasRef = useRef(null)
  const analyserRef = useRef(null)
  const audioCtxRef = useRef(null)
  const animFrameRef = useRef(null)

  useEffect(() => () => {
    clearInterval(timerRef.current)
    cancelAnimationFrame(animFrameRef.current)
    audioCtxRef.current?.close()
    mediaRef.current?.stream?.getTracks().forEach(t => t.stop())
  }, [])

  function startAudioViz(stream) {
    try {
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 128
      source.connect(analyser)
      analyserRef.current = analyser
      audioCtxRef.current = audioCtx

      const draw = () => {
        // keep looping even if canvas isn't mounted yet (React async render)
        animFrameRef.current = requestAnimationFrame(draw)
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        const barCount = 28
        const gap = 3
        const barW = (canvas.width - gap * (barCount - 1)) / barCount
        for (let i = 0; i < barCount; i++) {
          const idx = Math.floor((i / barCount) * (data.length * 0.7))
          const ratio = data[idx] / 255
          const h = Math.max(4, ratio * canvas.height)
          const alpha = 0.35 + ratio * 0.65
          ctx.fillStyle = `rgba(129, 140, 248, ${alpha})`
          const x = i * (barW + gap)
          ctx.fillRect(x, canvas.height - h, barW, h)
        }
      }
      draw()
    } catch (e) {
      // viz failure is non-critical, ignore
    }
  }

  function stopAudioViz() {
    cancelAnimationFrame(animFrameRef.current)
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    const canvas = canvasRef.current
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  }

  async function startRecording() {
    setState('connecting')  // feedback instantáneo -- getUserMedia puede tardar >1s en responder
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = handleStop
      mediaRef.current = recorder
      recorder.start(1000)
      setState('recording')
      setDuration(0)
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
      startAudioViz(stream)
    } catch (e) {
      addToast('No se puede acceder al micrófono: ' + e.message, 'error')
      setState('idle')
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current)
    stopAudioViz()
    mediaRef.current?.stop()
    mediaRef.current?.stream?.getTracks().forEach(t => t.stop())
    setState('transcribing')
  }

  async function handleStop() {
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    const fd = new FormData()
    fd.append('file', blob, 'lecture.webm')

    try {
      // Paso 1 — Whisper transcribe todo tal cual (con ruido, interrupciones, etc.)
      setState('transcribing')
      const data = await apiUpload('/audio/transcribe', fd)
      const raw = data.text
      setRawTranscript(raw)

      if (!raw.trim()) {
        addToast('No se detectó audio. ¿El micrófono funcionaba?', 'warning')
        setState('idle')
        return
      }

      if (limpiarRuido) {
        // Paso 2 — LLM limpia el texto (quita ruido de fondo, interrupciones, muletillas)
        setState('cleaning')
        const cleanRes = await api('POST', '/audio/clean-transcript', { raw_transcript: raw })
        const cleaned = cleanRes.clean_text || raw
        setCleanTranscript(cleaned)
        setRemovedCount(cleanRes.removed_interruptions || 0)
        setTopic(cleanRes.estimated_topic || '')

        // Paso 3 — LLM resume el texto limpio (si es suficientemente largo)
        if (cleaned.length > 300) {
          setState('summarizing')
          const sumRes = await api('POST', '/generate-text/summary', {
            text: cleaned,
            difficulty: 'normal',
          })
          setSummary(sumRes.content || '')
        }

        if (cleanRes.estimated_topic && cleanRes.estimated_topic !== 'No determinado') {
          setTitle(cleanRes.estimated_topic)
        }
      } else {
        // Sin limpieza: el texto en bruto es el que se guarda, y se resume directamente
        setCleanTranscript(raw)
        if (raw.length > 300) {
          setState('summarizing')
          const sumRes = await api('POST', '/generate-text/summary', {
            text: raw,
            difficulty: 'normal',
          })
          setSummary(sumRes.content || '')
        }
      }

      setState('done')
    } catch (e) {
      if (!e.quotaExceeded) addToast('Error procesando grabación: ' + e.message, 'error')
      setState('idle')
    }
  }

  async function saveAsDocument() {
    const textToSave = cleanTranscript || rawTranscript
    if (!textToSave) return
    try {
      const blob = new Blob([textToSave], { type: 'text/plain' })
      const file = new File([blob], `${title || 'Apuntes de voz'}.txt`, { type: 'text/plain' })
      const fd = new FormData()
      fd.append('file', file)
      if (subjectId) fd.append('subject_id', String(subjectId))
      await apiUpload('/documents/upload-text', fd)
      addToast('Apuntes guardados como documento', 'success')
      onTranscriptionSaved?.()
      reset()
    } catch (e) {
      addToast(e.message, 'error')
    }
  }

  function reset() {
    setState('idle')
    setRawTranscript('')
    setCleanTranscript('')
    setSummary('')
    setTopic('')
    setTitle('')
    setDuration(0)
  }

  const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  const STEPS = {
    transcribing: { icon: '🎙️', label: 'Transcribiendo con Whisper...',     sub: 'Paso 1 de 3' },
    cleaning:     { icon: '🧹', label: 'Limpiando la grabación...',   sub: 'Paso 2 de 3 — quitando ruido y comentarios ajenos al contenido' },
    summarizing:  { icon: '📝', label: 'Generando resumen estructurado...', sub: limpiarRuido ? 'Paso 3 de 3' : 'Paso 2 de 2' },
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-100">Apuntes por voz</h3>
        <span className="badge-blue text-[10px]">
          {IS_ELECTRON ? '🎙️ Whisper local' : '🎙️ Transcripción en la nube'}
        </span>
      </div>

      <div className="card py-6 space-y-4">

        {/* IDLE */}
        {state === 'idle' && (
          <div className="text-center space-y-3">
            <div className="text-5xl">🎙️</div>
            <p className="text-sm text-slate-400">
              Graba tus apuntes de voz para convertirlos en texto.
            </p>

            <button
              type="button"
              onClick={() => setLimpiarRuido(v => !v)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left
                ${limpiarRuido ? 'bg-primary-600/15 border-primary-600' : 'bg-slate-800 border-slate-700'}`}
            >
              <span className="text-lg shrink-0">🔇</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-100">Quitar ruido e interrupciones</p>
                <p className="text-xs text-slate-500">
                  Filtra automáticamente ruido de fondo y comentarios que no tengan
                  relación con el contenido de la grabación.
                </p>
              </div>
              <div className={`w-11 h-6 rounded-full shrink-0 relative transition-colors
                ${limpiarRuido ? 'bg-primary-500' : 'bg-slate-600'}`}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform
                  ${limpiarRuido ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            </button>

            <button onClick={startRecording} disabled={state === 'connecting'} className="btn-primary disabled:opacity-50">
              Empezar a grabar
            </button>
          </div>
        )}

        {/* CONNECTING — feedback instantáneo mientras el navegador activa el micrófono */}
        {state === 'connecting' && (
          <div className="text-center space-y-3">
            <div className="text-5xl animate-pulse">⏳</div>
            <p className="text-sm font-medium text-slate-200 animate-pulse">Activando micrófono…</p>
            <p className="text-xs text-slate-500">Esto puede tardar un instante la primera vez</p>
          </div>
        )}

        {/* RECORDING */}
        {state === 'recording' && (
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <p className="text-2xl font-mono font-bold text-red-400">{fmt(duration)}</p>
            </div>
            {/* Audio level visualizer */}
            <canvas
              ref={canvasRef}
              width={320}
              height={48}
              className="w-full h-12 rounded-xl bg-slate-900/60"
            />
            <p className="text-xs text-slate-500">Grabando... habla con claridad</p>
            <button onClick={stopRecording} className="btn-danger px-8">
              ⏹️ Parar y procesar
            </button>
          </div>
        )}

        {/* PROCESSING (transcribing / cleaning / summarizing) */}
        {['transcribing', 'cleaning', 'summarizing'].includes(state) && (
          <div className="text-center space-y-3">
            <div className="text-4xl animate-pulse">{STEPS[state].icon}</div>
            <p className="text-sm font-medium text-slate-200 animate-pulse">{STEPS[state].label}</p>
            <p className="text-xs text-slate-500">{STEPS[state].sub}</p>
            {/* Progress dots */}
            <div className="flex justify-center gap-2 pt-1">
              {['transcribing', 'cleaning', 'summarizing'].map((s, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${
                  state === s ? 'bg-primary-400 animate-pulse' :
                  ['transcribing', 'cleaning', 'summarizing'].indexOf(state) > i
                    ? 'bg-emerald-400' : 'bg-slate-600'
                }`} />
              ))}
            </div>
          </div>
        )}

        {/* DONE */}
        {state === 'done' && (
          <div className="space-y-4 text-left">
            {/* Header stats */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-emerald-400 font-medium text-sm flex items-center gap-1">
                ✓ Procesado ({fmt(duration)})
              </span>
              {removedCount > 0 && (
                <span className="badge-yellow text-[10px]">
                  🧹 {removedCount} interrupción{removedCount !== 1 ? 'es' : ''} eliminada{removedCount !== 1 ? 's' : ''}
                </span>
              )}
              {topic && topic !== 'No determinado' && (
                <span className="badge-blue text-[10px]">📚 {topic}</span>
              )}
            </div>

            {/* Title input */}
            <input
              className="input"
              placeholder="Nombre de los apuntes"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />

            {/* Summary */}
            {summary && (
              <div className="bg-primary-900/30 border border-primary-700 rounded-xl p-3">
                <p className="text-xs text-primary-400 font-semibold mb-1">Resumen automático</p>
                <p className="text-sm text-slate-200 leading-relaxed">{summary}</p>
              </div>
            )}

            {/* Transcript */}
            <div className="bg-slate-900/60 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-500 font-medium">
                  {limpiarRuido ? 'Transcripción limpia' : 'Transcripción'}
                </p>
                {limpiarRuido && (
                  <button
                    onClick={() => setShowRaw(s => !s)}
                    className="text-[10px] text-slate-500 hover:text-slate-300"
                  >
                    {showRaw ? 'Ver limpia' : 'Ver original'}
                  </button>
                )}
              </div>
              <div className="max-h-36 overflow-auto">
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {limpiarRuido && showRaw ? rawTranscript : cleanTranscript}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={reset} className="btn-secondary flex-1 btn-sm">
                Descartar
              </button>
              <button onClick={saveAsDocument} className="btn-primary flex-1 btn-sm">
                💾 Guardar como documento
              </button>
            </div>
          </div>
        )}
      </div>

      {state === 'idle' && (
        <div className="text-xs text-slate-500 space-y-1">
          {IS_ELECTRON ? (
            <p>🎙️ Transcripción con Whisper — procesa el audio en tu ordenador, sin subir nada.</p>
          ) : (
            <p>🎙️ Transcripción con Whisper en la nube — requiere conexión a internet.</p>
          )}
          <p>✨ Limpieza y resumen automáticos — requiere conexión a internet.</p>
        </div>
      )}
    </div>
  )
}
