import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore, api, getAuthHeader, getLocalAuthHeader, handleUnauthorized } from '../store/appStore'
import TutorAvatar from '../components/Tutor/TutorAvatar'
import TutorWhiteboard from '../components/Tutor/TutorWhiteboard'
import { useTranslation } from 'react-i18next'
import { hablar, parar as pararVoz, elegirVoz, detectarIdioma } from '../lib/deviceTts'
const TUTOR_NAME = () => localStorage.getItem('tutor_name') || 'Tutor'

// Indicador de "está escribiendo..."
function TypingDots() {
  return (
    <div className="flex items-end gap-1 px-3 py-2">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-violet-400"
          style={{ animation: `tutorDot 1s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
      <style>{`
        @keyframes tutorDot {
          0%,100% { transform: translateY(0); opacity:.4 }
          50%      { transform: translateY(-5px); opacity:1 }
        }
      `}</style>
    </div>
  )
}

function Message({ msg, tutorName }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-2 items-end ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && <TutorAvatar state="idle" size={32} />}
      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
        isUser
          ? 'bg-violet-600 text-white rounded-br-sm'
          : 'bg-slate-700 text-slate-100 rounded-bl-sm'
      }`}>
        {msg.content}
      </div>
    </div>
  )
}

export default function TutorPage() {
  const { t } = useTranslation()
  const { addToast, apiBase, tutorTtsRate, openQuotaExceeded } = useAppStore()
  const initialMsg = t('tutor.initialMsg', { name: TUTOR_NAME() })
  const [input, setInput]           = useState('')
  const [messages, setMessages]     = useState([{ role: 'tutor', content: initialMsg }])
  const [tutorState, setTutorState] = useState('idle')
  const [recording, setRecording]   = useState(false)
  const [connecting, setConnecting] = useState(false)  // feedback instantáneo: micro solicitándose (getUserMedia en curso)
  const [showBoard, setShowBoard]   = useState(false)
  const [boardMaximized, setBoardMaximized] = useState(false)
  const [speaking, setSpeaking]     = useState(false)
  const [voiceMode, setVoiceMode]   = useState(false)
  const [socraticMode, setSocraticMode] = useState(false)
  const [boardContent, setBoardContent] = useState(null)
  // Contexto de documento
  const [docs, setDocs]             = useState([])
  const [selectedDocId, setSelectedDocId] = useState(null)
  // Historial de sesiones
  const [sessions, setSessions]     = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [sessionId, setSessionId]   = useState(null)  // ID de la sesión guardada actual
  const saveTimerRef                = useRef(null)
  const messagesEndRef = useRef(null)
  const messagesRef    = useRef(messages) // espejo de `messages` para evitar closures obsoletas en
                                          // sendMessage/handleRecordingStop (la cadena de callbacks de
                                          // voz se encadena a sí misma y "congela" el snapshot de
                                          // `messages` del render en que se creó si se lee directamente)
  const mountedRef      = useRef(true)   // false en cuanto se desmonta -- evita que una respuesta
                                          // async (transcripción, TTS) que llega tarde siga hablando
                                          // o escuchando después de haber salido de esta pantalla
  const voiceModeRef    = useRef(false)
  const voiceActiveRef  = useRef(false)   // usuario está en conversación de voz
  const recordStartRef  = useRef(null)    // timestamp inicio grabación
  const canvasRef       = useRef(null)
  const bargeInRef      = useRef(null)   // monitoriza voz mientras tutor habla
  const bargeInTriggeredRef = useRef(false) // true si el detector ya pilló tu voz ANTES de que
                                             // el audio del tutor estuviera listo (para no reproducirlo
                                             // "fantasma" por encima de tu grabación -- ver speakTutor)
  const voiceStreamRef  = useRef(null)   // stream de mic PERSISTENTE durante toda la conversación de voz
                                         // (se abre 1 sola vez al activar y se reutiliza en cada turno --
                                         // en este equipo getUserMedia() tarda ~5s, así que reabrirlo en
                                         // cada turno causaba la pausa larga Y una condición de carrera
                                         // con el monitor de barge-in que dejaba la conversación muda)
  const analyserRef    = useRef(null)
  const audioCtxRef    = useRef(null)
  const animFrameRef   = useRef(null)
  const silenceRef     = useRef(null)   // timestamp cuando empezó el silencio
  const emptyTranscriptRef = useRef(0)  // nº de transcripciones vacías seguidas (detecta micro silencioso/dispositivo erróneo)
  const silentCyclesRef = useRef(0)     // nº de veces SEGUIDAS que se rearma la escucha sin haber
                                         // detectado voz (el usuario no dijo nada) -- tras varias
                                         // seguidas, asumimos que se fue/no va a responder y apagamos
                                         // el micro solos, en vez de escuchar para siempre
  const SILENT_CYCLES_LIMIT = 4         // ~4 × (1.8s silencio + grabación) ≈ 15-20s sin hablar → corta
  const [silencePct, setSilencePct] = useState(0)  // 0-100 para la barra de countdown

  // Grabación: MediaRecorder estándar -- esta es la versión PROBADA que
  // funcionaba bien (turnos completos, transcripción correcta, barge-in OK).
  // (El experimento de captura PCM continua + pre-buffer de hoy quedó
  // descartado: producía grabaciones vacías -- wav=44 bytes -- de forma
  // consistente, así que volvemos a la base que sí funcionaba.)
  const mediaRef  = useRef(null)   // MediaRecorder activo
  const chunksRef = useRef([])     // trozos de audio capturados en la grabación actual
  const hadVoiceRef = useRef(false) // true si en ALGÚN momento de esta grabación se detectó
                                     // volumen por encima del umbral de silencio -- si se queda
                                     // en false (el usuario no dijo nada, solo silencio/ruido de
                                     // fondo), NO mandamos el audio a Whisper: transcribir un
                                     // clip en silencio hace que "alucine" texto inventado
                                     // (comportamiento conocido del modelo, no un fallo del micro)

  const SILENCE_THRESHOLD = 22    // volumen medio < 22/255 = silencio (subido desde 12 para ignorar ruido ambiente)
  const SILENCE_MS        = 1800  // 1.8s de silencio → auto-envía
  const MIN_RECORD_MS     = 1000  // mínimo 1s grabando antes de detectar silencio
  const MAX_RECORD_MS     = 45000 // 45s -- red de seguridad: si por lo que sea (ruido de fondo
                                  // constante, glitch del analizador...) el silencio NUNCA se
                                  // detecta, cortamos de todas formas. Sin esto, una grabación que
                                  // no termina nunca queda "abierta" sin límite y puede acabar
                                  // colgando la app -- mejor cortar y reintentar que congelarse.

  // Sync ref para callbacks
  useEffect(() => { voiceModeRef.current = voiceMode }, [voiceMode])
  useEffect(() => { messagesRef.current = messages }, [messages])

  // Cortar micro/voz/habla al salir de esta pantalla -- si no, el tutor se
  // queda hablando y/o escuchando en segundo plano indefinidamente (el
  // usuario lo reportó: solo paraba si volvía y pulsaba el botón de stop).
  useEffect(() => {
    return () => {
      mountedRef.current = false
      voiceActiveRef.current = false
      stopRecording()
      stopSpeaking()
      releaseVoiceStream()
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Cargar documentos disponibles y sesiones anteriores
  useEffect(() => {
    api('GET', '/documents?limit=50').then(r => setDocs(r.items || [])).catch(() => {})
    api('GET', '/tutor/sessions').then(r => setSessions(r.items || [])).catch(() => {})
  }, [])

  // Autoguardar sesión cuando hay mensajes (debounced 3s)
  useEffect(() => {
    if (messages.length <= 1) return  // solo el mensaje inicial, no guardar
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        const doc = docs.find(d => d.id === selectedDocId)
        const firstUserMsg = messages.find(m => m.role === 'user')
        const title = firstUserMsg
          ? firstUserMsg.content.slice(0, 60) + (firstUserMsg.content.length > 60 ? '…' : '')
          : 'Sesión de tutoría'
        const body = { title, document_id: selectedDocId, messages }
        if (sessionId) {
          await api('PUT', `/tutor/sessions/${sessionId}`, body)
        } else {
          const res = await api('POST', '/tutor/sessions', body)
          setSessionId(res.id)
        }
        // Refrescar lista de sesiones
        api('GET', '/tutor/sessions').then(r => setSessions(r.items || [])).catch(() => {})
      } catch { /* guardar es opcional */ }
    }, 3000)
    return () => clearTimeout(saveTimerRef.current)
  }, [messages, selectedDocId])

  // Devuelve el stream de mic PERSISTENTE de toda la conversación de voz,
  // abriendo uno nuevo solo la primera vez (o si el anterior dejó de estar
  // activo, p.ej. el usuario revocó el permiso). Reutilizarlo es la clave de
  // una conversación fluida: en este equipo getUserMedia() tarda ~5 segundos,
  // así que volver a pedirlo en cada turno (grabación Y vigilancia de
  // barge-in) causaba pausas larguísimas Y una condición de carrera -- el
  // turno siguiente arrancaba su propio getUserMedia antes de que el monitor
  // de barge-in terminara de abrir el suyo, dejando streams huérfanos,
  // grabaciones simultáneas y transcripciones vacías que acababan apagando
  // el modo voz en silencio.
  async function ensureVoiceStream() {
    if (voiceStreamRef.current?.active) return voiceStreamRef.current
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
    voiceStreamRef.current = stream
    return stream
  }

  // Cierra y libera el stream persistente -- SOLO al terminar la conversación
  // de voz (nunca entre turnos, que es justo lo que queremos evitar)
  function releaseVoiceStream() {
    voiceStreamRef.current?.getTracks().forEach(t => t.stop())
    voiceStreamRef.current = null
  }

  // Barge-in: vigila el MISMO stream persistente mientras el tutor habla, e
  // interrumpe si detecta voz del usuario. Al no abrir un stream propio, el
  // arranque es instantáneo y no compite por el micrófono con la grabación.
  function startBargeIn() {
    try {
      const stream = voiceStreamRef.current
      if (!stream) return
      if (bargeInRef.current) return  // ya hay un monitor corriendo -- no duplicar
      bargeInTriggeredRef.current = false  // nueva ronda: aún no se ha pillado tu voz
      // AudioContext propio y dedicado SOLO a este analizador -- es la
      // estructura probada que funciona de verdad (ver nota en startAudioViz).
      const ctx      = new AudioContext()
      const source   = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      bargeInRef.current = { ctx, analyser, frameId: null }

      const BARGE_THRESHOLD = 20   // umbral barge-in (ajustado entre el suelo de ruido ~0-8 y la voz real ~41)
      let voiceStart = null

      const check = () => {
        if (!bargeInRef.current) return
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length

        if (avg > BARGE_THRESHOLD) {
          if (!voiceStart) { voiceStart = Date.now() }
          else if (Date.now() - voiceStart > 300) {
            // ¡El usuario habla! Cortamos al tutor y grabamos -- mismo stream
            // de siempre, así que no hay que pedir permiso ni esperar nada
            bargeInTriggeredRef.current = true  // avisa a speakTutor: si su audio aún no
                                                 // estaba listo, que NO lo reproduzca encima
            stopBargeIn()
            pararVoz()
            setSpeaking(false)
            setTutorState('idle')
            startRecording()
            return
          }
        } else {
          voiceStart = null
        }
        bargeInRef.current.frameId = requestAnimationFrame(check)
      }
      check()
    } catch { /* análisis no disponible */ }
  }

  function stopBargeIn() {
    if (!bargeInRef.current) return
    cancelAnimationFrame(bargeInRef.current.frameId)
    bargeInRef.current.ctx.close()
    bargeInRef.current = null
    // OJO: el MediaStream NO se toca aquí -- es el persistente de toda la
    // conversación, compartido con la grabación; lo cierra releaseVoiceStream()
  }

  // Trocea la respuesta en frases (agrupando las muy cortas) -- clave para la
  // fluidez: en vez de esperar el audio de TODA la respuesta antes de sonar
  // nada, pedimos y reproducimos frase a frase, con la frase siguiente ya
  // pidiéndose en segundo plano mientras suena la actual. Con respuestas
  // largas esto reduce el "silencio" inicial de varios segundos a el tiempo
  // de generar solo la primera frase.
  function splitIntoSpeechChunks(text) {
    const rawSentences = text.match(/[^.!?…]+[.!?…]+(\s+|$)|[^.!?…]+$/g) || [text]
    const chunks = []
    let current = ''
    for (const s of rawSentences) {
      current += s
      if (current.trim().length >= 120) {
        chunks.push(current.trim())
        current = ''
      }
    }
    if (current.trim()) chunks.push(current.trim())
    return chunks.filter(Boolean)
  }

  // Lee un trozo con la voz del PROPIO dispositivo. Antes se pedia el audio a
  // /tts/speak (Azure): costaba dinero, consumia cupo y habia que precargar la
  // frase siguiente para que no se notara el hueco de red. Hablando el aparato
  // no hay espera, asi que la tuberia de precarga sobra.
  //
  // El idioma se detecta del propio texto: el tutor responde en el idioma en
  // que se le pregunta, y el dispositivo elige su mejor voz para ese idioma.
  async function hablarTrozo(texto) {
    const lang = detectarIdioma(texto)
    const voz = await elegirVoz(lang)
    if (!voz) throw new Error('sin voz para ' + lang)
    await hablar(texto, { lang, voz, rate: tutorTtsRate })
  }

  // Reproducir TTS de la respuesta del tutor -- frase a frase, con la
  // siguiente frase precargándose en segundo plano mientras suena la actual.
  async function speakTutor(text) {
    const chunks = splitIntoSpeechChunks(text)
    if (chunks.length === 0) return
    try {
      setSpeaking(true)
      setTutorState('responding')

      // CLAVE: arrancamos el detector de tu voz YA MISMO, en paralelo con la
      // generación del audio del tutor -- así no esperamos ese tiempo para
      // empezar a escucharte. Si ya estás hablando cuando esté listo el
      // audio, lo detecta en ~50-100ms y graba al instante.
      if (voiceActiveRef.current) startBargeIn()

      for (let i = 0; i < chunks.length; i++) {
        // GUARDA: si ya empezaste a hablar (el detector te pilló y está
        // grabando), NO seguimos leyendo por encima -- sería una voz
        // "fantasma" sonando mientras grabamos.
        if (bargeInTriggeredRef.current || !mountedRef.current) return
        await hablarTrozo(chunks[i])
      }
      setSpeaking(false)
      setTutorState('idle')
      stopBargeIn()
      // startRecording() reutiliza el stream persistente -- arranque
      // instantáneo, sin "Activando micrófono…" entre turnos
      if (voiceActiveRef.current) startRecording()
    } catch {
      // Si el detector ya te pilló hablando, ya gestionó todo él solo
      // (paró el monitor, puso "idle" y arrancó la grabación) -- no dupliques
      if (bargeInTriggeredRef.current) return
      stopBargeIn()
      setSpeaking(false)
      setTutorState('idle')
      if (voiceActiveRef.current) startRecording()
    }
  }

  function stopSpeaking() {
    stopBargeIn()
    pararVoz()
    setSpeaking(false)
    setTutorState('idle')
  }

  async function sendMessage(text, attempt = 0, historyOverride = null) {
    if (!text.trim()) return
    const userMsg = { role: 'user', content: text.trim() }
    const history = historyOverride || (attempt === 0 ? [...messagesRef.current, userMsg] : messagesRef.current)
    if (attempt === 0) {
      setMessages(history)
      messagesRef.current = history  // actualizar el espejo al instante: el siguiente turno (incluso si
                                      // llega antes de que React re-renderice) debe partir de este historial
      setInput('')
    }
    setTutorState('thinking')

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 45000)  // 45s timeout
      const res = await api('POST', '/tutor/chat', {
        messages: history.map(m => ({ role: m.role === 'tutor' ? 'assistant' : 'user', content: m.content })),
        document_id: selectedDocId || null,
        socratic_mode: socraticMode,
      }, controller.signal)
      clearTimeout(timeout)
      // Extraer contenido de pizarra (acepta [/PIZARRA], [PIZARRA] repetido, o fin de cadena)
      const raw = res.response
      const pStart = raw.indexOf('[PIZARRA]')
      let reply = raw
      if (pStart !== -1) {
        const after = raw.slice(pStart + 9)
        const closeIdx = after.search(/\[\/PIZARRA\]|\[PIZARRA\]/i)
        const boardData = (closeIdx === -1 ? after : after.slice(0, closeIdx)).trim()
        if (boardData) { setBoardContent(boardData); setShowBoard(true) }
        reply = raw.slice(0, pStart).trim()
      }
      setMessages(prev => [...prev, { role: 'tutor', content: reply }])
      setTutorState('happy')
      if (voiceActiveRef.current) {
        setTimeout(() => speakTutor(reply), 300)
      } else {
        setTimeout(() => setTutorState('idle'), 2000)
      }
    } catch (e) {
      if (attempt < 3) {
        const delay = [1000, 2000, 3000][attempt]
        setTimeout(() => sendMessage(text, attempt + 1, history), delay)
        return
      }
      setMessages(prev => [...prev, { role: 'tutor', content: t('tutor.connectError') }])
      setTutorState('error')
      setTimeout(() => setTutorState('idle'), 3000)
      if (voiceActiveRef.current) startRecording()
    }
  }

  // Visualizador + detección de silencio automática
  function startAudioViz(stream, onSilence) {
    try {
      // AudioContext propio y dedicado SOLO a este analizador -- cada
      // consumidor (grabación, viz, barge-in) con el suyo. Es la estructura
      // probada que de verdad capta tu voz (la alternativa de compartir un
      // único contexto entre varios ScriptProcessorNode/Analyser dejó de
      // oírte por completo -- capturas vacías).
      const ctx      = new AudioContext()
      const source   = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 128
      source.connect(analyser)
      analyserRef.current = analyser
      audioCtxRef.current = ctx
      silenceRef.current  = null

      const draw = () => {
        animFrameRef.current = requestAnimationFrame(draw)
        const canvas = canvasRef.current
        const data   = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length

        // Detección de silencio — solo después del mínimo de grabación
        const recordedMs = recordStartRef.current ? Date.now() - recordStartRef.current : 0

        // Red de seguridad: si llevamos demasiado tiempo grabando sin que
        // salte el silencio (ruido de fondo constante, glitch del analizador,
        // lo que sea), cortamos igualmente -- nunca debe quedar "abierto" sin
        // límite (eso es lo que probablemente coló hoy y congeló la app).
        if (recordedMs > MAX_RECORD_MS) {
          setSilencePct(0)
          onSilence?.()
          return
        }

        if (avg < SILENCE_THRESHOLD && recordedMs > MIN_RECORD_MS) {
          if (!silenceRef.current) silenceRef.current = Date.now()
          const elapsed = Date.now() - silenceRef.current
          setSilencePct(Math.min(100, (elapsed / SILENCE_MS) * 100))
          if (elapsed >= SILENCE_MS) {
            setSilencePct(0)
            onSilence?.()
            return  // para el loop
          }
        } else {
          silenceRef.current = null
          setSilencePct(0)
          if (avg >= SILENCE_THRESHOLD) hadVoiceRef.current = true
        }

        // Dibujar barras
        if (!canvas) return
        const c    = canvas.getContext('2d')
        c.clearRect(0, 0, canvas.width, canvas.height)
        const bars = 24, gap = 2
        const barW = (canvas.width - gap * (bars - 1)) / bars
        for (let i = 0; i < bars; i++) {
          const idx   = Math.floor((i / bars) * (data.length * 0.7))
          const ratio = data[idx] / 255
          const h     = Math.max(3, ratio * canvas.height)
          c.fillStyle = `rgba(167,139,250,${0.35 + ratio * 0.65})`
          c.fillRect(i * (barW + gap), canvas.height - h, barW, h)
        }
      }
      draw()
    } catch {}
  }

  function stopAudioViz() {
    cancelAnimationFrame(animFrameRef.current)
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    silenceRef.current  = null
    setSilencePct(0)
    const canvas = canvasRef.current
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  }

  // Handler compartido cuando para la grabación
  async function handleRecordingStop() {
    if (!mountedRef.current) return
    // Si en toda la grabación nunca hubo volumen por encima del umbral de
    // silencio, el usuario no dijo nada (p.ej. se quedó callado tras hablar
    // el tutor) -- NO lo mandamos a Whisper: transcribir un clip en silencio
    // le hace "alucinar" texto inventado (p.ej. "gracias") en vez de
    // devolver vacío. Simplemente seguimos escuchando, sin gastar cuota.
    if (!hadVoiceRef.current) {
      setTutorState('idle')
      silentCyclesRef.current += 1
      if (silentCyclesRef.current >= SILENT_CYCLES_LIMIT) {
        silentCyclesRef.current = 0
        voiceActiveRef.current = false
        setVoiceMode(false)
        stopRecording()
        releaseVoiceStream()
        setTutorState('idle')
        addToast(t('tutor.voiceModeAutoStopped'), 'info')
        return
      }
      if (voiceActiveRef.current) startRecording()
      return
    }
    silentCyclesRef.current = 0  // hubo voz de verdad -- resetea el contador de inactividad
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    const fd   = new FormData()
    fd.append('file', blob, 'voice.webm')
    try {
      setTutorState('thinking')
      const authHeader = await getAuthHeader()
      const localHeader = await getLocalAuthHeader()
      let res  = await fetch(`${apiBase}/audio/transcribe`, { method: 'POST', headers: { ...authHeader, ...localHeader }, body: fd })
      if (!mountedRef.current) return
      if (res.status === 401) {
        // Puede ser un bache de red puntual en la renovación automática
        // (móvil en segundo plano, wifi inestable) y no una sesión
        // realmente caducada -- forzamos un refresco y reintentamos una
        // vez antes de rendirnos y cortar lo que el alumno está haciendo.
        const retryHeader = await getAuthHeader(true)
        res = await fetch(`${apiBase}/audio/transcribe`, { method: 'POST', headers: { ...retryHeader, ...localHeader }, body: fd })
        if (res.status === 401) {
          handleUnauthorized()
          setTutorState('idle')
          return
        }
      }
      const data = await res.json()
      if (!res.ok) {
        setTutorState('idle')
        if (data.quota_exceeded) {
          openQuotaExceeded(data.detail, data.category)
          voiceActiveRef.current = false  // corta el ciclo de auto-grabación — no tiene sentido reintentar
          return
        }
        addToast(`Transcripción fallida: ${data.detail || 'Error de Whisper'}`, 'error')
        if (voiceActiveRef.current) startRecording()
        return
      }
      if (data.text?.trim()) {
        emptyTranscriptRef.current = 0  // reset -- el micro SÍ está captando voz
        sendMessage(data.text)
      } else {
        // Whisper no detectó ninguna voz en el audio grabado. Esto casi siempre
        // significa que la app está capturando del dispositivo de entrada
        // EQUIVOCADO (p.ej. un micro virtual de auriculares VR puesto como
        // predeterminado en Windows, que graba silencio digital puro) y NO
        // del micrófono físico real -- aunque el usuario esté hablando.
        // Sin este aviso, el ciclo se repite en silencio indefinidamente y
        // parece que "el micrófono no funciona" sin dar ninguna pista de por qué.
        emptyTranscriptRef.current += 1
        if (emptyTranscriptRef.current >= 2) {
          voiceActiveRef.current = false
          setVoiceMode(false)
          stopRecording()
          releaseVoiceStream()
          setTutorState('idle')
          emptyTranscriptRef.current = 0
          addToast(
            '🎤 No se detecta voz en el audio grabado (varios intentos vacíos). ' +
            'Es probable que Windows esté usando un micrófono incorrecto como predeterminado ' +
            '(p.ej. un dispositivo virtual de auriculares VR que graba silencio). ' +
            'Ve a Configuración → Sistema → Sonido → Entrada y selecciona tu micrófono real, luego inténtalo de nuevo.',
            'warning',
            12000
          )
          return
        }
        setTutorState('idle')
        if (voiceActiveRef.current) startRecording()
      }
    } catch {
      setTutorState('error')
      addToast('No se pudo conectar con el servicio de transcripción', 'error')
      setTimeout(() => { setTutorState('idle'); if (voiceActiveRef.current) startRecording() }, 2000)
    }
  }

  // Iniciar grabación con stream ya existente (barge-in reutiliza el mic
  // abierto: arranque instantáneo, sin pedir permiso ni reabrir el dispositivo).
  // MediaRecorder estándar -- la versión PROBADA que de verdad te oía bien.
  function startRecordingWithStream(stream) {
    chunksRef.current = []
    hadVoiceRef.current = false
    const mr = new MediaRecorder(stream)
    mediaRef.current = mr
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => handleRecordingStop()
    mr.start()
    recordStartRef.current = Date.now()
    setRecording(true)
    startAudioViz(stream, () => stopRecording())
  }

  // Iniciar grabación reutilizando el stream persistente de la conversación
  // (o abriéndolo la 1ª vez). En los turnos siguientes es instantáneo: nada
  // de esperar a getUserMedia entre cada intervención.
  async function startRecording() {
    setConnecting(true)  // feedback visual instantáneo -- solo se nota en la 1ª activación (~5s)
    try {
      const stream = await ensureVoiceStream()
      startRecordingWithStream(stream)
    } catch (e) {
      addToast('No se puede acceder al micrófono', 'error')
    } finally {
      setConnecting(false)
    }
  }

  function stopRecording() {
    stopAudioViz()
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop()  // dispara onstop -> handleRecordingStop (async)
    }
    // OJO: ya NO paramos los tracks del stream -- es el persistente de toda
    // la conversación de voz; lo libera releaseVoiceStream() al terminarla
    setRecording(false)
  }

  async function toggleMic() {
    if (recording || speaking) {
      // Parar conversación de voz
      voiceActiveRef.current = false
      stopRecording()
      stopSpeaking()
      releaseVoiceStream()
      return
    }
    // Iniciar conversación de voz
    voiceActiveRef.current = true
    emptyTranscriptRef.current = 0  // sesión nueva: olvida fallos previos (p.ej. tras corregir el micro en Windows)
    silentCyclesRef.current = 0     // sesión nueva: olvida los silencios de la conversación anterior
    startRecording()
  }

  // Activar/desactivar modo conversación
  function toggleVoiceMode() {
    const next = !voiceMode
    setVoiceMode(next)
    voiceActiveRef.current = next
    if (next) {
      addToast(t('tutor.voiceModeActivated'), 'success')
      emptyTranscriptRef.current = 0  // sesión nueva: olvida fallos previos
      startRecording()
    } else {
      stopRecording()
      stopSpeaking()
      releaseVoiceStream()
    }
  }

  function newSession() {
    stopRecording(); stopSpeaking()
    setMessages([{ role: 'tutor', content: t('tutor.initialMsg', { name: TUTOR_NAME() }) }])
    setSessionId(null); setBoardContent(null); setInput('')
    setShowHistory(false)
  }

  async function loadSession(id) {
    try {
      const s = await api('GET', `/tutor/sessions/${id}`)
      setMessages(s.messages)
      setSessionId(s.id)
      setSelectedDocId(s.document_id || null)
      setBoardContent(null)
      setShowHistory(false)
    } catch { addToast(t('tutor.sessionLoadError'), 'error') }
  }

  async function deleteSession(id, e) {
    e.stopPropagation()
    await api('DELETE', `/tutor/sessions/${id}`)
    setSessions(prev => prev.filter(s => s.id !== id))
    if (sessionId === id) newSession()
  }

  const isThinking = tutorState === 'thinking'
  const isBusy     = isThinking || speaking || recording || connecting

  return (
    <div className="relative flex flex-col md:flex-row h-full overflow-hidden">

      {/* ── Panel izquierdo: Chat — siempre a pantalla completa, la pizarra ya no le quita espacio ── */}
      <div className="flex flex-col w-full md:w-[420px] h-full shrink-0 border-b md:border-b-0 md:border-r border-slate-800">

        {/* Header */}
        <div className="border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 px-4 py-3">
            <TutorAvatar state={tutorState} size={40} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-100 text-sm">{TUTOR_NAME()}</p>
              <p className="text-xs text-slate-500">
                {tutorState === 'thinking'   && t('tutor.thinking')}
                {tutorState === 'responding' && t('tutor.responding')}
                {tutorState === 'idle'       && t('tutor.idle')}
                {tutorState === 'happy'      && t('tutor.happy')}
                {tutorState === 'error'      && t('tutor.error')}
              </p>
            </div>
            <button onClick={() => setShowHistory(s => !s)} title={t('tutor.sessionsHistory')}
              className={`btn-ghost btn-sm text-xs px-2 ${showHistory ? 'text-violet-400' : ''}`}>🕐</button>
            <button onClick={newSession} title={t('tutor.newSession')}
              className="btn-ghost btn-sm text-xs px-2">✏️</button>
            <button onClick={() => setShowBoard(s => { if (s) setBoardMaximized(false); return !s })}
              className="btn-ghost btn-sm text-xs px-2"
            >{showBoard ? t('tutor.hideBoard') : t('tutor.showBoard')}</button>
          </div>

          {/* Selector de documento */}
          <div className="px-4 pb-2 flex items-center gap-2">
            <span className="text-[10px] text-slate-500 shrink-0">{t('tutor.context')}</span>
            <select
              value={selectedDocId || ''}
              onChange={e => setSelectedDocId(e.target.value ? Number(e.target.value) : null)}
              className="flex-1 text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:border-violet-500"
            >
              <option value=''>{t('tutor.noDocFreeTheme')}</option>
              {docs.map(d => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>
          </div>

          {/* Panel historial */}
          {showHistory && (
            <div className="mx-3 mb-2 bg-slate-900 rounded-xl border border-slate-700 max-h-48 overflow-y-auto">
              {sessions.length === 0
                ? <p className="text-xs text-slate-600 p-3">{t('tutor.noSessions')}</p>
                : sessions.map(s => (
                    <div key={s.id} onClick={() => loadSession(s.id)}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-slate-800 cursor-pointer group border-b border-slate-800 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-200 truncate">{s.title}</p>
                        <p className="text-[10px] text-slate-500">
                          {s.message_count} mensajes · {s.document_title || t('tutor.noDocument')} · {new Date(s.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button onClick={e => deleteSession(s.id, e)}
                        className="text-slate-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 shrink-0">✕</button>
                    </div>
                  ))
              }
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <Message key={i} msg={msg} tutorName={TUTOR_NAME()} />
          ))}
          {isThinking && (
            <div className="flex items-end gap-2">
              <TutorAvatar state="thinking" size={32} />
              <div className="bg-slate-700 rounded-2xl rounded-bl-sm">
                <TypingDots />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-slate-800 shrink-0 space-y-2">
          {/* Visualizador de audio + countdown silencio */}
          {recording && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                <canvas
                  ref={canvasRef}
                  width={300}
                  height={28}
                  className="flex-1 h-7 rounded-lg bg-slate-900/60"
                />
                <span className="text-[10px] text-slate-500 shrink-0 w-16 text-right">
                  {silencePct > 0 ? t('tutor.sending') : t('tutor.listening')}
                </span>
              </div>
              {/* Barra de silencio: se llena cuando dejas de hablar */}
              {silencePct > 0 && (
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all"
                    style={{ width: `${silencePct}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Fila: mic + textarea + enviar */}
          <div className="flex gap-2 items-end">
            <button
              data-tour="tutor-mic"
              onClick={toggleMic}
              disabled={isThinking || connecting}
              className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-lg transition-all ${
                recording  ? 'bg-red-600 text-white ring-2 ring-red-500/50' :
                connecting ? 'bg-amber-500 text-white ring-2 ring-amber-400/50 animate-pulse' :
                speaking   ? 'bg-violet-600 text-white ring-2 ring-violet-500/50' :
                'btn-secondary'
              }`}
              title={connecting ? t('tutor.micActivating') : recording ? t('tutor.micStop') : speaking ? t('tutor.micStopVoice') : t('tutor.micSpeak')}
            >
              {recording ? '⏹' : connecting ? '⏳' : speaking ? '🔊' : '🎙️'}
            </button>
            <textarea
              className="input flex-1 resize-none py-2 text-sm"
              placeholder={t('tutor.writePlaceholder')}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
              rows={1}
              style={{ minHeight: 40, maxHeight: 100 }}
              disabled={isBusy}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isBusy}
              className="btn-primary w-10 h-10 shrink-0 flex items-center justify-center text-lg"
            >↑</button>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-600">{t('tutor.enterToSend')}</p>
            <div className="flex items-center gap-2">
              <button
                data-tour="tutor-socratic"
                onClick={() => setSocraticMode(v => !v)}
                className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                  socraticMode ? 'bg-amber-600 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
                title={t('tutor.socraticModeDesc')}
              >
                {socraticMode ? t('tutor.socraticModeOn') : t('tutor.socraticMode')}
              </button>
              <button
                onClick={toggleVoiceMode}
                className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                  voiceMode ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
                title="Conversación de voz automática"
              >
                {voiceMode ? t('tutor.voiceModeOn') : t('tutor.voiceMode')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pestaña para reabrir la pizarra — siempre asomando por el borde
           derecho en escritorio; se desvanece mientras el panel está abierto ── */}
      <button
        data-tour="tutor-board"
        onClick={() => setShowBoard(true)}
        title={t('tutor.showBoard')}
        className={`hidden md:flex fixed right-0 top-1/2 -translate-y-1/2 z-30 flex-col items-center gap-1
                   bg-slate-800 border border-slate-700 border-r-0 rounded-l-lg px-1.5 py-3
                   text-slate-300 hover:bg-slate-700 hover:text-violet-300 shadow-lg
                   transition-opacity duration-200
                   ${showBoard ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        <span className="text-sm">🖊️</span>
        <span className="text-[10px] tracking-wide" style={{ writingMode: 'vertical-rl' }}>
          {t('tutor.whiteboard')}
        </span>
      </button>

      {/* ── Panel derecho: Pizarra — siempre montada (conserva el dibujo al
           colapsarla) y se desliza de derecha a izquierda con transform, en
           vez de aparecer/desaparecer de golpe. En escritorio ocupa el hueco
           junto al chat (o toda la pantalla si se maximiza); en móvil siempre
           a pantalla completa. ── */}
      <div className={`fixed top-0 bottom-0 right-0 left-0 ${boardMaximized ? 'md:left-0' : 'md:left-[420px]'}
                       z-40 flex flex-col overflow-hidden bg-slate-950 md:border-l border-slate-800
                       transition-transform duration-300 ease-in-out
                       ${showBoard ? 'translate-x-0' : 'translate-x-full pointer-events-none'}`}>
        <div className="px-4 py-2 border-b border-slate-800 shrink-0 flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-300">{t('tutor.whiteboard')}</span>
          <span className="text-xs text-slate-500 hidden sm:inline">{t('tutor.whiteboardDesc')}</span>
          <button
            onClick={() => setBoardMaximized(m => !m)}
            title={boardMaximized ? t('tutor.restoreBoard') : t('tutor.expandBoard')}
            className="ml-auto btn-ghost btn-sm text-xs px-2 hidden md:inline-flex"
          >{boardMaximized ? '⤡' : '⤢'}</button>
          <button
            onClick={() => { setShowBoard(false); setBoardMaximized(false) }}
            title={t('tutor.hideBoard')}
            className="btn-ghost btn-sm text-xs px-2"
          >✕</button>
        </div>
        <TutorWhiteboard tutorContent={boardContent} />
      </div>
    </div>
  )
}
