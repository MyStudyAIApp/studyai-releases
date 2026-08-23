import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore, api, getAuthHeader, getLocalAuthHeader, handleUnauthorized, IS_MOBILE } from '../store/appStore'
import { useTranslation } from 'react-i18next'
import { hablar, parar as pararVoz, elegirVoz, abrirInstalacionDeVoces } from '../lib/deviceTts'

// ── Constantes ────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { id: 'english',    flag: '🇬🇧', label: 'English' },
  { id: 'french',     flag: '🇫🇷', label: 'Français' },
  { id: 'german',     flag: '🇩🇪', label: 'Deutsch' },
  { id: 'italian',    flag: '🇮🇹', label: 'Italiano' },
  { id: 'portuguese', flag: '🇵🇹', label: 'Português' },
  { id: 'spanish',    flag: '🇪🇸', label: 'Español' },
  { id: 'chinese',    flag: '🇨🇳', label: '中文' },
  { id: 'japanese',   flag: '🇯🇵', label: '日本語' },
  { id: 'arabic',     flag: '🇸🇦', label: 'العربية' },
  { id: 'russian',    flag: '🇷🇺', label: 'Русский' },
  { id: 'latin',      flag: '🏛️',  label: 'Latín' },
  { id: 'polish',     flag: '🇵🇱', label: 'Polski' },
]

const LEVELS = [
  { id: 'A1', desc: 'Principiante' },
  { id: 'A2', desc: 'Básico' },
  { id: 'B1', desc: 'Intermedio' },
  { id: 'B2', desc: 'Avanzado' },
  { id: 'C1', desc: 'Experto' },
  { id: 'C2', desc: 'Maestro' },
]

const TOPICS = [
  { id: 'daily_life',  icon: '🏠', label: 'Vida cotidiana' },
  { id: 'travel',      icon: '✈️', label: 'Viajes' },
  { id: 'work',        icon: '💼', label: 'Trabajo' },
  { id: 'food',        icon: '🍽️', label: 'Comida' },
  { id: 'technology',  icon: '💻', label: 'Tecnología' },
  { id: 'culture',     icon: '🎭', label: 'Cultura' },
  { id: 'nature',      icon: '🌿', label: 'Naturaleza' },
  { id: 'free',        icon: '🎲', label: 'Mixto' },
  { id: 'vocab',       icon: '📖', label: 'Vocabulario', vocabOnly: true },
]

const SPEED_OPTIONS = [
  { id: 'slow',      label: 'Lento',       rate: '-20%', icon: '🐢' },
  { id: 'normal',    label: 'Normal',      rate: '+0%',  icon: '▶️' },
  { id: 'fast',      label: 'Rápido',      rate: '+25%', icon: '⚡' },
  { id: 'vfast',     label: 'Muy rápido',  rate: '+50%', icon: '🚀' },
  { id: 'lightning', label: 'Fugaz',       rate: '+80%', icon: '💨' },
]

const LEVEL_CLS = {
  A1: { ring: 'border-emerald-600 bg-emerald-900/30', text: 'text-emerald-400' },
  A2: { ring: 'border-teal-600 bg-teal-900/30',       text: 'text-teal-400' },
  B1: { ring: 'border-blue-600 bg-blue-900/30',       text: 'text-blue-400' },
  B2: { ring: 'border-violet-600 bg-violet-900/30',   text: 'text-violet-400' },
  C1: { ring: 'border-amber-600 bg-amber-900/30',     text: 'text-amber-400' },
  C2: { ring: 'border-rose-600 bg-rose-900/30',       text: 'text-rose-400' },
}

// Idioma que se le pide al dispositivo para cada asignatura. Antes esto era un
// catalogo de voces concretas de Azure; ahora la voz la elige el aparato entre
// las que tenga instaladas para ese idioma.
// El latin no existe como voz en ningun sistema: se lee con voz italiana, que
// es la pronunciacion mas cercana de las disponibles.
const CONV_LANGS = {
  english:    'en-GB',
  french:     'fr-FR',
  german:     'de-DE',
  italian:    'it-IT',
  portuguese: 'pt-PT',
  spanish:    'es-ES',
  chinese:    'zh-CN',
  japanese:   'ja-JP',
  arabic:     'ar-SA',
  russian:    'ru-RU',
  polish:     'pl-PL',
  latin:      'it-IT',
}

const WHISPER_LANGS = {
  english: 'en', french: 'fr', german: 'de', italian: 'it',
  portuguese: 'pt', spanish: 'es', chinese: 'zh', japanese: 'ja',
  arabic: 'ar', russian: 'ru', polish: 'pl', latin: 'la',
}

const TYPE_LABELS = {
  fill_blank:         'Rellenar hueco',
  translate_word:     'Traducir palabra',
  multiple_choice:    'Opción múltiple',
  conjugate:          'Conjugar verbo',
  translate_sentence: 'Traducir frase',
  translate_text:     'Traducir texto',
  correct_error:      'Corregir error',
  transform:          'Transformar frase',
  write_sentence:     'Escribir frase',
  write_paragraph:    'Escribir párrafo',
  comprehension:      'Comprensión lectora',
  paraphrase:         'Reformular',
}

// VAD — igual que TutorPage
const SILENCE_THRESHOLD = 22    // volumen medio < 22/255 (subido desde 12 para ignorar ruido ambiente)
const SILENCE_MS        = 1800  // 1.8 s de silencio → auto-envía
const MIN_RECORD_MS     = 1000  // mínimo 1 s antes de detectar silencio

// ── Componentes de examen ─────────────────────────────────────────────────────

function ExerciseCard({ exercise, answer, onAnswer, readOnly = false }) {
  const { t } = useTranslation()
  const { type, instruction, question, options, passage } = exercise

  if (type === 'multiple_choice') {
    return (
      <div className="space-y-4">
        <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">{instruction}</p>
        <p className="text-slate-100 text-base font-medium leading-relaxed">{question}</p>
        <div className="space-y-2">
          {(options || []).map(opt => {
            const key = opt.split(')')[0].trim() + ')'
            const isSelected = answer === key
            return (
              <button key={opt} onClick={() => !readOnly && onAnswer(key)} disabled={readOnly}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                  isSelected
                    ? 'border-primary-500 bg-primary-900/40 text-primary-200'
                    : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:border-slate-600 hover:bg-slate-700/40 disabled:hover:border-slate-700'
                }`}>{opt}</button>
            )
          })}
        </div>
      </div>
    )
  }

  if (type === 'true_false') {
    // Parsear "Verdadero — justificación" o "Falso — justificación"
    const sepIdx    = (answer || '').indexOf(' — ')
    const vfPart    = sepIdx > -1 ? answer.substring(0, sepIdx) : answer || ''
    const justifPart = sepIdx > -1 ? answer.substring(sepIdx + 3) : ''
    return (
      <div className="space-y-4">
        <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">{instruction}</p>
        <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60">
          <p className="text-slate-100 text-base font-medium leading-relaxed">{question}</p>
        </div>
        <div className="flex gap-3">
          {[t('languages.trueFalseTrue'), t('languages.trueFalseFalse')].map(choice => {
            const isTrue = choice === t('languages.trueFalseTrue')
            const rawChoice = isTrue ? 'Verdadero' : 'Falso'
            return (
            <button key={choice} onClick={() => !readOnly && onAnswer(`${rawChoice} — ${justifPart}`)}
              disabled={readOnly}
              className={`flex-1 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all ${
                vfPart === rawChoice
                  ? isTrue
                    ? 'border-emerald-500 bg-emerald-900/30 text-emerald-200'
                    : 'border-red-500 bg-red-900/20 text-red-200'
                  : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600 disabled:hover:border-slate-700'
              }`}>
              {isTrue ? '✅' : '❌'} {choice}
            </button>
            )
          })}
        </div>
        <textarea className="input w-full text-sm resize-none" rows={2}
          placeholder={t('languages.trueFalseWhy')}
          value={justifPart}
          onChange={e => !readOnly && onAnswer(`${vfPart} — ${e.target.value}`)}
          readOnly={readOnly} />
      </div>
    )
  }

  if (type === 'comprehension') {
    return (
      <div className="space-y-4">
        <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">{instruction}</p>
        <div className="p-4 bg-slate-800/40 rounded-xl border-l-4 border-primary-600/60">
          <p className="text-[10px] text-primary-400 uppercase tracking-wider font-semibold mb-2">{t('languages.textPassage')}</p>
          <p className="text-slate-200 text-sm leading-relaxed">{passage || question}</p>
        </div>
        {passage && (
          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{t('languages.textQuestion')}</p>
            <p className="text-slate-100 text-sm font-medium">{question}</p>
          </div>
        )}
        <textarea className="input w-full text-sm resize-none" rows={3} placeholder={t('languages.exerciseAnswer')}
          value={answer || ''} onChange={e => !readOnly && onAnswer(e.target.value)} readOnly={readOnly} autoFocus={!readOnly} />
      </div>
    )
  }

  if (type === 'translate_text') {
    return (
      <div className="space-y-4">
        <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">{instruction}</p>
        <div className="p-4 bg-slate-800/40 rounded-xl border-l-4 border-amber-600/60">
          <p className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold mb-2">{t('languages.textInSpanish')}</p>
          <p className="text-slate-200 text-sm leading-relaxed">{question}</p>
        </div>
        <textarea className="input w-full text-sm resize-none" rows={5} placeholder={t('languages.translateTextHint')}
          value={answer || ''} onChange={e => !readOnly && onAnswer(e.target.value)} readOnly={readOnly} autoFocus={!readOnly} />
      </div>
    )
  }

  if (type === 'write_paragraph') {
    return (
      <div className="space-y-4">
        <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">{instruction}</p>
        <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{t('languages.writeTopic')}</p>
          <p className="text-slate-100 text-base font-medium leading-relaxed">{question}</p>
        </div>
        <textarea className="input w-full text-sm resize-none" rows={5} placeholder={t('languages.writeParagraphHint')}
          value={answer || ''} onChange={e => !readOnly && onAnswer(e.target.value)} readOnly={readOnly} autoFocus={!readOnly} />
      </div>
    )
  }

  const isLong = ['translate_sentence', 'correct_error', 'transform', 'paraphrase', 'write_sentence'].includes(type)
  const displayQuestion = type === 'fill_blank' ? question.replace(/___/g, '______') : question

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">{instruction}</p>
      <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60">
        <p className="text-slate-100 text-base font-medium leading-relaxed">{displayQuestion}</p>
      </div>
      {isLong ? (
        <textarea className="input w-full text-sm resize-none" rows={3} placeholder={t('languages.exerciseAnswer')}
          value={answer || ''} onChange={e => !readOnly && onAnswer(e.target.value)} readOnly={readOnly} autoFocus={!readOnly} />
      ) : (
        <input type="text" className="input w-full text-sm" placeholder={t('languages.exerciseShortAnswer')}
          value={answer || ''} onChange={e => !readOnly && onAnswer(e.target.value)} readOnly={readOnly} autoFocus={!readOnly} />
      )}
    </div>
  )
}

function ExerciseResult({ exercise, result, index }) {
  const { t } = useTranslation()
  if (!result) return null
  const correct = result.correct
  const partial = !correct && result.points > 0
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${correct ? 'border-emerald-700/50 bg-emerald-950/20' : partial ? 'border-amber-700/50 bg-amber-950/20' : 'border-red-800/40 bg-red-950/10'}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg shrink-0 mt-0.5">{correct ? '✅' : partial ? '🟡' : '❌'}</span>
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-xs text-slate-500 uppercase tracking-wider">{index + 1}. {t(`languages.types.${exercise.type}`) || exercise.type}</p>
          <p className="text-sm text-slate-300 font-medium line-clamp-2">{exercise.question}</p>
          {!correct && (
            <div className="mt-2 space-y-1 text-xs">
              <p><span className="text-slate-500">{t('languages.yourAnswerLabel')}</span><span className="text-red-400 font-mono">{result.user_answer || t('languages.noAnswerLabel')}</span></p>
              <p><span className="text-slate-500">{t('languages.correctAnswerLabel')}</span><span className="text-emerald-400 font-mono">{result.correct_answer}</span></p>
              {result.explanation && <p className="text-slate-400 italic mt-1">{result.explanation}</p>}
            </div>
          )}
        </div>
        <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${correct ? 'bg-emerald-900/60 text-emerald-300' : partial ? 'bg-amber-900/60 text-amber-300' : 'bg-slate-800 text-slate-500'}`}>{result.points}pt</span>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function LanguagesPage() {
  const { t } = useTranslation()
  const { addToast, apiBase, langsTtsRate, openQuotaExceeded } = useAppStore()

  // Translated arrays (computed inside component so t() works)
  const LEVEL_DESCS = { A1: t('languages.levels.A1'), A2: t('languages.levels.A2'), B1: t('languages.levels.B1'), B2: t('languages.levels.B2'), C1: t('languages.levels.C1'), C2: t('languages.levels.C2') }
  const TOPIC_LABELS = { daily_life: t('languages.topics.daily_life'), travel: t('languages.topics.travel'), work: t('languages.topics.work'), food: t('languages.topics.food'), technology: t('languages.topics.technology'), culture: t('languages.topics.culture'), nature: t('languages.topics.nature'), free: t('languages.topics.free'), vocab: t('languages.topics.vocab') }
  const SPEED_LABELS = { slow: t('languages.speeds.slow'), normal: t('languages.speeds.normal'), fast: t('languages.speeds.fast'), vfast: t('languages.speeds.vfast'), lightning: t('languages.speeds.lightning') }
  const TYPE_LABELS_T = { fill_blank: t('languages.types.fill_blank'), translate_word: t('languages.types.translate_word'), multiple_choice: t('languages.types.multiple_choice'), conjugate: t('languages.types.conjugate'), translate_sentence: t('languages.types.translate_sentence'), translate_text: t('languages.types.translate_text'), correct_error: t('languages.types.correct_error'), transform: t('languages.types.transform'), write_sentence: t('languages.types.write_sentence'), write_paragraph: t('languages.types.write_paragraph'), comprehension: t('languages.types.comprehension'), paraphrase: t('languages.types.paraphrase') }

  // Config
  const [language, setLanguage] = useState('english')
  const [level, setLevel]       = useState('B1')
  const [topic, setTopic]       = useState('free')
  const [mode, setMode]         = useState('exam')

  // Navegación
  const [screen, setScreen]   = useState('config')
  const [loading, setLoading] = useState(false)

  // Examen
  const [exercises, setExercises]   = useState([])
  const [answers, setAnswers]       = useState({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [evaluation, setEvaluation] = useState(null)
  const [evaluating, setEvaluating] = useState(false)

  // Comprensión oral
  const MAX_PLAYS = 3
  const [listenExercise, setListenExercise]   = useState(null)   // {texto, preguntas}
  const [listenPlays, setListenPlays]         = useState(0)      // veces que se ha reproducido
  const [listenAnswers, setListenAnswers]     = useState([])
  const [listenFeedback, setListenFeedback]   = useState('')
  const [listenEvaluating, setListenEvaluating] = useState(false)
  const [vfSelections, setVfSelections]       = useState([])     // [{vf: null|'v'|'f', justif: ''}]

  // Opciones de sesión
  const [ttsSpeed, setTtsSpeed]         = useState('fast')        // 'slow'|'fast'|'vfast'|'lightning'
  const [questionType, setQuestionType] = useState('desarrollo')  // 'desarrollo'|'verdadero_falso'
  const [vocabPdfs, setVocabPdfs]       = useState([])
  const [vocabLoading, setVocabLoading] = useState(false)
  const [vocabPreviews, setVocabPreviews] = useState({})   // {filename: texto|null|'loading'}
  const [vocabDragOver, setVocabDragOver] = useState(false)

  // Conversación
  const [convScenario, setConvScenario]   = useState('')
  const [convMessages, setConvMessages]   = useState([])
  const [convErrors, setConvErrors]       = useState([])
  const [convTurnCount, setConvTurnCount] = useState(0)
  const [convTextInput, setConvTextInput] = useState('')
  const [convEval, setConvEval]           = useState(null)

  // UI conversación — estados visibles
  const [recording, setRecording]   = useState(false)
  const [connecting, setConnecting] = useState(false)  // feedback instantáneo: micro solicitándose (getUserMedia en curso)
  const [speaking, setSpeaking]     = useState(false)
  const [processing, setProcessing] = useState(false)
  const [silencePct, setSilencePct] = useState(0)

  // Refs conversación
  const mountedRef     = useRef(true)   // false en cuanto se desmonta -- evita que un TTS/transcripción
                                        // que llega tarde (tras un await) siga hablando/escuchando
                                        // después de haber salido de esta pantalla
  const mediaRef       = useRef(null)
  const chunksRef      = useRef([])
  const messagesEndRef = useRef(null)
  const canvasRef      = useRef(null)
  const analyserRef    = useRef(null)
  const audioCtxRef    = useRef(null)
  const animFrameRef   = useRef(null)
  const silenceRef     = useRef(null)
  const recordStartRef = useRef(null)
  const bargeInRef     = useRef(null)
  const voiceStreamRef = useRef(null)   // stream de mic PERSISTENTE durante toda la conversación
                                        // (igual que en TutorPage: getUserMedia tarda ~5s en este equipo;
                                        // reutilizarlo evita pausas largas Y la condición de carrera con barge-in)
  // Ref para convMessages (evita stale closures en callbacks de audio)
  const convMessagesRef = useRef([])
  const languageRef     = useRef(language)
  const levelRef        = useRef(level)
  const convErrorsRef   = useRef([])
  // Controla si el bucle de voz debe continuar
  const activeRef = useRef(false)
  const emptyTranscriptRef = useRef(0)  // nº de transcripciones vacías seguidas (detecta micro silencioso/dispositivo erróneo)
  const silentCyclesRef = useRef(0)     // nº de veces SEGUIDAS que se rearma la escucha sin audio real
                                         // (el usuario no dijo nada) -- tras varias, asumimos que ha
                                         // terminado de hablar y cerramos la conversación solos, puntuándola
  const SILENT_CYCLES_LIMIT = 4         // ~4 × (1.8s silencio + grabación) ≈ 15-20s sin hablar → corta
  const langsTtsRateRef = useRef(langsTtsRate ?? '+12%')
  // Secuencia de speak: al incrementar, invalida el bucle de frases en curso
  const speakSeqRef = useRef(0)

  // Sincronizar refs con state
  // La velocidad local (ttsSpeed) tiene prioridad sobre la global (langsTtsRate)
  useEffect(() => { langsTtsRateRef.current = langsTtsRate ?? '+12%' }, [langsTtsRate])
  useEffect(() => {
    const rate = SPEED_OPTIONS.find(s => s.id === ttsSpeed)?.rate ?? '+25%'
    langsTtsRateRef.current = rate  // sobreescribe el global para esta página
  }, [ttsSpeed])
  useEffect(() => { convMessagesRef.current = convMessages }, [convMessages])
  useEffect(() => { languageRef.current = language }, [language])
  useEffect(() => { levelRef.current = level }, [level])
  useEffect(() => { convErrorsRef.current = convErrors }, [convErrors])

  // Derived
  const langInfo  = LANGUAGES.find(l => l.id === language)
  const levelInfo = LEVELS.find(l => l.id === level)
  const topicInfo = TOPICS.find(t => t.id === topic)
  const levelCls  = LEVEL_CLS[level]
  const answeredCount = exercises.filter(ex => {
    const ans = answers[ex.id]?.trim() || ''
    if (!ans) return false
    if (ex.type === 'true_false') return ans.startsWith('Verdadero') || ans.startsWith('Falso')
    return true
  }).length

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [convMessages, processing])

  // Limpiar al salir de conversación
  useEffect(() => {
    return () => {
      mountedRef.current = false
      activeRef.current = false
      stopAudioViz()
      stopBargeIn()
      releaseVoiceStream()
      pararVoz()
    }
  }, [])

  // ── VAD helpers (idénticos a TutorPage) ─────────────────────────────────

  function startAudioViz(stream, onSilence) {
    try {
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

        const recordedMs = recordStartRef.current ? Date.now() - recordStartRef.current : 0
        if (avg < SILENCE_THRESHOLD && recordedMs > MIN_RECORD_MS) {
          if (!silenceRef.current) silenceRef.current = Date.now()
          const elapsed = Date.now() - silenceRef.current
          setSilencePct(Math.min(100, (elapsed / SILENCE_MS) * 100))
          if (elapsed >= SILENCE_MS) {
            setSilencePct(0)
            onSilence?.()
            return
          }
        } else {
          silenceRef.current = null
          setSilencePct(0)
        }

        if (!canvas) return
        const c    = canvas.getContext('2d')
        c.clearRect(0, 0, canvas.width, canvas.height)
        const bars = 24, gap = 2
        const barW = (canvas.width - gap * (bars - 1)) / bars
        for (let i = 0; i < bars; i++) {
          const idx   = Math.floor((i / bars) * (data.length * 0.7))
          const ratio = data[idx] / 255
          const h     = Math.max(3, ratio * canvas.height)
          c.fillStyle = `rgba(139,92,246,${0.35 + ratio * 0.65})`
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

  // Devuelve el stream de mic PERSISTENTE de toda la conversación, abriendo
  // uno nuevo solo la 1ª vez (o si el anterior dejó de estar activo, p.ej.
  // el usuario revocó el permiso). Reutilizarlo es la clave de una
  // conversación fluida: en este equipo getUserMedia() tarda ~5 segundos, así
  // que pedirlo de nuevo en cada turno (grabación Y vigilancia de barge-in)
  // causaba pausas larguísimas y una condición de carrera -- el turno
  // siguiente abría su propio stream antes de que el monitor de barge-in
  // terminara de abrir el suyo, dejando streams huérfanos, grabaciones
  // simultáneas y transcripciones vacías que acababan apagando la conversación.
  async function ensureVoiceStream() {
    if (voiceStreamRef.current?.active) return voiceStreamRef.current
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
    voiceStreamRef.current = stream
    return stream
  }

  // Cierra y libera el stream persistente -- SOLO al terminar la conversación
  // (nunca entre turnos, que es justo lo que queremos evitar)
  function releaseVoiceStream() {
    voiceStreamRef.current?.getTracks().forEach(t => t.stop())
    voiceStreamRef.current = null
  }

  // Barge-in: vigila el MISMO stream persistente mientras la IA habla, e
  // interrumpe si detecta voz del usuario. Al no abrir un stream propio, el
  // arranque es instantáneo y no compite por el micrófono con la grabación.
  function startBargeIn() {
    try {
      const stream = voiceStreamRef.current
      if (!stream) return
      const ctx      = new AudioContext()
      const source   = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      bargeInRef.current = { ctx, analyser, frameId: null }

      const BARGE_THRESHOLD = 20
      let voiceStart = null

      const check = () => {
        if (!bargeInRef.current) return
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length

        if (avg > BARGE_THRESHOLD) {
          if (!voiceStart) voiceStart = Date.now()
          else if (Date.now() - voiceStart > 300) {
            // ¡El usuario habla! Cortamos a la IA y grabamos -- mismo stream
            // de siempre, así que no hay que pedir permiso ni esperar nada
            stopBargeIn()
            speakSeqRef.current++          // invalida el bucle de frases
            pararVoz()
            setSpeaking(false)
            startRecording()
            return
          }
        } else {
          voiceStart = null
        }
        bargeInRef.current.frameId = requestAnimationFrame(check)
      }
      check()
    } catch {}
  }

  function stopBargeIn() {
    if (!bargeInRef.current) return
    cancelAnimationFrame(bargeInRef.current.frameId)
    bargeInRef.current.ctx.close()
    bargeInRef.current = null
    // OJO: el MediaStream NO se toca aquí -- es el persistente de toda la
    // conversación, compartido con la grabación; lo cierra releaseVoiceStream()
  }

  // ── TTS ──────────────────────────────────────────────────────────────────

  // Trocea la respuesta en frases (agrupando las muy cortas) -- igual que en
  // TutorPage: pedir y reproducir frase a frase reduce el silencio inicial
  // de "esperar el audio de toda la respuesta" a solo la primera frase.
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

  // En Idiomas SI es probable que falte la voz: se habla aleman, japones o
  // ruso, y el aparato solo tiene lo que tenga instalado. Se avisa en vez de
  // quedarse mudo sin explicacion. En Android se le puede mandar directamente
  // a la pantalla del sistema para instalarla; en web no hay forma (probado).
  function avisarVozQueFalta(lang) {
    const nombre = new Intl.DisplayNames(['es'], { type: 'language' }).of(lang.split('-')[0]) || lang
    if (IS_MOBILE) {
      addToast(`Tu dispositivo no tiene voz en ${nombre}. Puedes instalarla desde los ajustes de tu móvil.`, 'warning', 8000)
      abrirInstalacionDeVoces()
    } else {
      addToast(`Tu dispositivo no tiene voz en ${nombre}. Instálala desde los ajustes de tu sistema para escuchar esta lección.`, 'warning', 8000)
    }
  }

  async function speakAI(text) {
    const lang = CONV_LANGS[languageRef.current]
    if (!lang) {
      if (activeRef.current) setTimeout(() => startRecording(), 200)
      return
    }
    const chunks = splitIntoSpeechChunks(text)
    if (chunks.length === 0) {
      if (activeRef.current) startRecording()
      return
    }

    const seq = ++speakSeqRef.current
    setSpeaking(true)

    try {
      const voz = await elegirVoz(lang)
      if (!voz) { avisarVozQueFalta(lang); return }
      let bargeInStarted = false
      for (let i = 0; i < chunks.length; i++) {
        if (speakSeqRef.current !== seq || !mountedRef.current) return   // barge-in llegó antes, o ya salimos de la pantalla
        // el barge-in se arma con la primera frase ya sonando (igual que
        // antes), no hace falta repetirlo en cada frase siguiente
        if (!bargeInStarted && activeRef.current) { startBargeIn(); bargeInStarted = true }
        await hablar(chunks[i], { lang, voz, rate: langsTtsRateRef.current })
      }
    } catch {
      // TTS falló silenciosamente
    } finally {
      if (speakSeqRef.current === seq) {
        setSpeaking(false)
        stopBargeIn()
        // startRecording() reutiliza el stream persistente -- arranque
        // instantáneo, sin "Activando micrófono…" entre turnos
        if (activeRef.current) startRecording()
      }
    }
  }

  // ── Grabación ────────────────────────────────────────────────────────────

  async function handleRecordingStop() {
    if (!mountedRef.current) return
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    if (blob.size < 1000) {
      // Audio demasiado corto -- el usuario no dijo nada. Tras varios
      // silencios seguidos, asumimos que ha terminado y cerramos/puntuamos
      // la conversación solos en vez de escuchar para siempre.
      silentCyclesRef.current += 1
      if (silentCyclesRef.current >= SILENT_CYCLES_LIMIT) {
        silentCyclesRef.current = 0
        endConversation()
        return
      }
      if (activeRef.current) startRecording()
      return
    }
    silentCyclesRef.current = 0  // hubo audio real -- resetea el contador de inactividad
    const fd = new FormData()
    fd.append('file', blob, 'voice.webm')
    setProcessing(true)
    try {
      const whisperLang = WHISPER_LANGS[languageRef.current] || 'en'
      const authHeader = await getAuthHeader()
      const localHeader = await getLocalAuthHeader()
      let res  = await fetch(`${apiBase}/languages/transcribe?language=${whisperLang}`, { method: 'POST', headers: { ...authHeader, ...localHeader }, body: fd })
      if (res.status === 401) {
        // Puede ser un bache de red puntual en la renovación automática
        // y no una sesión realmente caducada -- forzamos un refresco y
        // reintentamos una vez antes de rendirnos.
        const retryHeader = await getAuthHeader(true)
        res = await fetch(`${apiBase}/languages/transcribe?language=${whisperLang}`, { method: 'POST', headers: { ...retryHeader, ...localHeader }, body: fd })
        if (res.status === 401) {
          handleUnauthorized()
          setProcessing(false)
          return
        }
      }
      if (!mountedRef.current) return
      const data = await res.json()
      if (!res.ok) {
        setProcessing(false)
        if (data.quota_exceeded) {
          openQuotaExceeded(data.detail, data.category)
          activeRef.current = false  // corta el ciclo de auto-grabación — no tiene sentido reintentar
          return
        }
        addToast(`Transcripción fallida: ${data.detail || 'Error de Whisper'}`, 'error')
        if (activeRef.current) setTimeout(() => startRecording(), 2000)
        return
      }
      if (data.text?.trim()) {
        emptyTranscriptRef.current = 0  // reset -- el micro SÍ está captando voz
        await handleTurn(data.text.trim())
      } else {
        // Whisper no detectó voz -- normalmente indica que Windows está usando
        // el dispositivo de entrada EQUIVOCADO (p.ej. un micro virtual de unos
        // auriculares VR puesto como predeterminado, que graba silencio digital
        // puro) y no el micrófono físico real. Sin aviso, el ciclo se repite en
        // silencio sin parar y parece que "el micrófono no funciona".
        emptyTranscriptRef.current += 1
        setProcessing(false)
        if (emptyTranscriptRef.current >= 2) {
          activeRef.current = false
          stopRecording()
          releaseVoiceStream()
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
        if (activeRef.current) startRecording()
      }
    } catch {
      addToast('No se pudo conectar con el servicio de transcripción', 'error')
      setProcessing(false)
      if (activeRef.current) setTimeout(() => startRecording(), 1000)
    }
  }

  function startRecordingWithStream(stream) {
    const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    chunksRef.current = []
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    rec.onstop = handleRecordingStop
    mediaRef.current       = rec
    recordStartRef.current = Date.now()
    rec.start()
    setRecording(true)
    startAudioViz(stream, () => stopRecording())
  }

  async function startRecording() {
    if (!activeRef.current) return
    setConnecting(true)  // feedback visual instantáneo -- solo se nota en la 1ª activación (~5s)
    try {
      const stream = await ensureVoiceStream()
      startRecordingWithStream(stream)
    } catch (e) {
      addToast('No se puede acceder al micrófono: ' + e.message, 'error')
      activeRef.current = false
      releaseVoiceStream()
    } finally {
      setConnecting(false)
    }
  }

  function stopRecording() {
    stopAudioViz()
    if (mediaRef.current?.state === 'recording') {
      mediaRef.current.stop()
      // OJO: ya NO paramos los tracks del stream -- es el persistente de toda
      // la conversación; lo libera releaseVoiceStream() al terminarla
    }
    setRecording(false)
  }

  // ── Turno de conversación ────────────────────────────────────────────────

  async function handleTurn(userText) {
    const userMsg = { role: 'user', content: userText }
    const history = [...convMessagesRef.current, userMsg]
    setConvMessages(history)
    setProcessing(true)

    try {
      const data = await api('POST', '/languages/conversation/turn', {
        language: languageRef.current,
        level:    levelRef.current,
        history:  history,
        user_message: userText,
      })

      if (data.error_note) {
        setConvErrors(prev => [...prev, data.error_note])
      }

      const aiMsg = { role: 'assistant', content: data.response }
      setConvMessages(prev => [...prev, aiMsg])
      setConvTurnCount(n => n + 1)
      setProcessing(false)
      await speakAI(data.response)
    } catch (e) {
      addToast('Error en el turno: ' + e.message, 'error')
      setProcessing(false)
      if (activeRef.current) startRecording()
    }
  }

  // ── Iniciar / Terminar conversación ──────────────────────────────────────

  async function startConversation() {
    setLoading(true)
    try {
      const data = await api('POST', '/languages/conversation/start', { language, level, topic })
      setConvScenario(data.scenario || '')
      const firstMsg = { role: 'assistant', content: data.first_message }
      setConvMessages([firstMsg])
      convMessagesRef.current = [firstMsg]
      setConvErrors([])
      convErrorsRef.current = []
      setConvTurnCount(0)
      setConvEval(null)
      setRecording(false)
      setSpeaking(false)
      setProcessing(false)
      activeRef.current = true
      emptyTranscriptRef.current = 0  // sesión nueva: olvida fallos previos (p.ej. tras corregir el micro en Windows)
      silentCyclesRef.current = 0     // sesión nueva: olvida los silencios de la conversación anterior
      setScreen('conversation')
      // TTS del primer mensaje → al acabar empieza a escuchar
      setTimeout(() => speakAI(data.first_message), 400)
    } catch (e) {
      addToast('Error al iniciar la conversación: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  function toggleMic() {
    if (recording || speaking) {
      activeRef.current = false
      stopRecording()
      stopBargeIn()
      releaseVoiceStream()
      pararVoz()
      setSpeaking(false)
    } else {
      activeRef.current = true
      emptyTranscriptRef.current = 0  // sesión nueva: olvida fallos previos
      silentCyclesRef.current = 0
      startRecording()
    }
  }

  // Enviar texto manual
  function sendTextTurn() {
    if (!convTextInput.trim() || recording || speaking || processing) return
    const text = convTextInput.trim()
    setConvTextInput('')
    // Parar grabación si la hay
    activeRef.current = false
    stopRecording()
    stopBargeIn()
    pararVoz()
    setSpeaking(false)
    // Enviar
    activeRef.current = true
    handleTurn(text)
  }

  async function endConversation() {
    activeRef.current = false
    stopRecording()
    stopBargeIn()
    releaseVoiceStream()
    pararVoz()
    setSpeaking(false)
    setRecording(false)
    setProcessing(false)

    if (convMessagesRef.current.filter(m => m.role === 'user').length === 0) {
      addToast(t('languages.missingTurn'), 'warning')
      return
    }
    setProcessing(true)
    try {
      const data = await api('POST', '/languages/conversation/evaluate', {
        language, level,
        history: convMessagesRef.current,
        errors:  convErrorsRef.current,
      })
      setConvEval(data)
      setScreen('conv_results')
    } catch (e) {
      addToast('Error al evaluar: ' + e.message, 'error')
    } finally {
      setProcessing(false)
    }
  }

  // ── Vocabulario de idiomas (PDFs e imágenes) ─────────────────────────────────

  async function loadVocabPdfs() {
    try {
      const data = await api('GET', `/languages/vocabulary/${language}`)
      setVocabPdfs(data.files || [])
    } catch {
      setVocabPdfs([])
    }
  }

  // Cargar al cambiar idioma
  useEffect(() => { loadVocabPdfs() }, [language]) // eslint-disable-line react-hooks/exhaustive-deps

  async function uploadVocabPdf(file) {
    setVocabLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const [authHeader, localHeader] = await Promise.all([getAuthHeader(), getLocalAuthHeader()])
      const res = await fetch(`${apiBase}/languages/vocabulary/upload?language=${language}`, {
        method: 'POST',
        headers: { ...authHeader, ...localHeader },
        body: fd,
      })
      if (!res.ok) throw new Error()
      await loadVocabPdfs()
      addToast(`"${file.name}" añadido como vocabulario de ${langInfo?.label}`, 'success')
    } catch {
      addToast('Error al subir el archivo de vocabulario', 'error')
    } finally {
      setVocabLoading(false)
    }
  }

  async function deleteVocabPdf(filename) {
    try {
      await api('DELETE', `/languages/vocabulary/${language}/${encodeURIComponent(filename)}`)
      await loadVocabPdfs()
      setVocabPreviews(p => { const n = {...p}; delete n[filename]; return n })
    } catch {
      addToast('Error al eliminar el archivo', 'error')
    }
  }

  async function togglePreview(filename) {
    if (vocabPreviews[filename] !== undefined) {
      // Ya cargado → toggle show/hide
      setVocabPreviews(p => ({ ...p, [filename]: p[filename] === null ? undefined : null }))
      return
    }
    setVocabPreviews(p => ({ ...p, [filename]: 'loading' }))
    try {
      const data = await api('GET', `/languages/vocabulary/${language}/${encodeURIComponent(filename)}/preview`)
      setVocabPreviews(p => ({ ...p, [filename]: data.text || '(sin texto extraído)' }))
    } catch {
      setVocabPreviews(p => ({ ...p, [filename]: '(error al cargar el texto)' }))
    }
  }

  function handleVocabDrop(e) {
    e.preventDefault()
    setVocabDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadVocabPdf(file)
  }

  // ── Verdadero / Falso — comprensión oral ─────────────────────────────────────

  function updateVF(i, field, value) {
    const next = [...vfSelections]
    if (!next[i]) next[i] = { vf: null, justif: '' }
    next[i] = { ...next[i], [field]: value }
    setVfSelections(next)
    const row  = next[i]
    const vf   = row.vf
    const just = row.justif || ''
    const ans  = vf ? (vf === 'v' ? `Verdadero — ${just}` : `Falso — ${just}`) : ''
    const nextAnswers = [...listenAnswers]
    nextAnswers[i] = ans
    setListenAnswers(nextAnswers)
  }

  // ── Comprensión oral ─────────────────────────────────────────────────────

  async function startListening() {
    setLoading(true)
    try {
      const data = await api('POST', '/languages/listening-comprehension', { language, level, topic, question_type: questionType })
      if (!data.texto || !data.preguntas?.length) throw new Error('Sin contenido')
      setListenExercise(data)
      setListenAnswers(new Array(data.preguntas.length).fill(''))
      setVfSelections(new Array(data.preguntas.length).fill(null).map(() => ({ vf: null, justif: '' })))
      setListenPlays(0)
      setListenFeedback('')
      setScreen('listening')
    } catch (e) {
      addToast('Error al generar el ejercicio: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function speakListenText(text) {
    const lang = CONV_LANGS[language]
    setSpeaking(true)
    setListenPlays(p => p + 1)
    try {
      const voz = await elegirVoz(lang)
      if (!voz) { avisarVozQueFalta(lang); return }
      await hablar(text, { lang, voz, rate: langsTtsRateRef.current })
    } catch {
      // el usuario paró, o el aparato no pudo: no hay nada que explicar aquí
    } finally {
      setSpeaking(false)
    }
  }

  function stopListenAudio() {
    pararVoz()
    setSpeaking(false)
  }


  async function evaluateListening() {
    if (questionType === 'verdadero_falso') {
      const missing = vfSelections.findIndex(s => !s?.vf)
      if (missing !== -1) {
        addToast(t('languages.missingVFAlert', { num: missing + 1 }), 'warning')
        return
      }
    } else {
      const unanswered = listenAnswers.findIndex(a => !a.trim())
      if (unanswered !== -1) {
        addToast(t('languages.missingAnswerAlert', { num: unanswered + 1 }), 'warning')
        return
      }
    }
    setListenEvaluating(true)
    try {
      const data = await api('POST', '/languages/listening-evaluate', {
        language, level,
        texto:         listenExercise.texto,
        preguntas:     listenExercise.preguntas,
        respuestas:    listenAnswers,
        question_type: questionType,
      })
      setListenFeedback(data.feedback)
      setScreen('listening_results')
    } catch (e) {
      addToast('Error al evaluar: ' + e.message, 'error')
    } finally {
      setListenEvaluating(false)
    }
  }

  // ── Examen ───────────────────────────────────────────────────────────────

  async function startExam() {
    setLoading(true)
    try {
      const data = await api('POST', '/languages/generate-exam', {
        language, level, topic, num_exercises: 8, question_type: questionType,
      })
      if (!data.exercises?.length) throw new Error('No se recibieron ejercicios')
      setExercises(data.exercises)
      setAnswers({})
      setCurrentIdx(0)
      setEvaluation(null)
      setScreen('exam')
    } catch (e) {
      addToast('Error al generar el examen: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function submitExam(force = false) {
    if (!force && answeredCount < exercises.length) {
      const missing = exercises.length - answeredCount
      if (!window.confirm(`Tienes ${missing} pregunta${missing > 1 ? 's' : ''} sin responder. ¿Entregar igualmente?`)) return
    }
    setEvaluating(true)
    try {
      const data = await api('POST', '/languages/evaluate-exam', {
        language, level,
        exercises: exercises.map(ex => ({ ...ex, user_answer: answers[ex.id] || '' })),
      })
      setEvaluation(data)
      setScreen('results')
    } catch (e) {
      addToast('Error al evaluar: ' + e.message, 'error')
    } finally {
      setEvaluating(false)
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // PANTALLA: CONFIGURACIÓN
  // ════════════════════════════════════════════════════════════════════════
  if (screen === 'config') return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">🌍 {t('languages.title')}</h1>
        <p className="text-sm text-slate-400 mt-1">{t('languages.practiceDesc')}</p>
      </div>

      {/* Modo */}
      <div data-tour="lang-mode" className="grid grid-cols-3 gap-2 sm:gap-3">
        <button onClick={() => setMode('exam')}
          className={`flex flex-col items-center gap-2 py-4 px-3 rounded-2xl border-2 transition-all ${
            mode === 'exam' ? 'border-primary-500 bg-primary-900/20 text-primary-200' : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600'
          }`}>
          <span className="text-3xl">✍️</span>
          <span className="font-bold text-sm">{t('languages.examMode')}</span>
          <span className="text-[10px] text-center leading-tight opacity-70">{t('languages.examModeDesc')}</span>
        </button>
        <button onClick={() => setMode('conversation')}
          className={`flex flex-col items-center gap-2 py-4 px-3 rounded-2xl border-2 transition-all ${
            mode === 'conversation' ? 'border-violet-500 bg-violet-900/20 text-violet-200' : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600'
          }`}>
          <span className="text-3xl">🎙️</span>
          <span className="font-bold text-sm">{t('languages.convMode')}</span>
          <span className="text-[10px] text-center leading-tight opacity-70">{t('languages.convModeDesc')}</span>
        </button>
        <button onClick={() => setMode('listening')}
          className={`flex flex-col items-center gap-2 py-4 px-3 rounded-2xl border-2 transition-all ${
            mode === 'listening' ? 'border-amber-500 bg-amber-900/20 text-amber-200' : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600'
          }`}>
          <span className="text-3xl">🎧</span>
          <span className="font-bold text-sm">{t('languages.listenMode')}</span>
          <span className="text-[10px] text-center leading-tight opacity-70">{t('languages.listenModeDesc')}</span>
        </button>
      </div>

      {/* Velocidad del narrador (solo para modos con audio) */}
      {mode !== 'exam' && (
        <div className="card space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('languages.speedTitle')}</p>
          <div className="grid grid-cols-5 gap-2">
            {SPEED_OPTIONS.map(s => (
              <button key={s.id} onClick={() => setTtsSpeed(s.id)}
                className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border-2 transition-all ${
                  ttsSpeed === s.id
                    ? mode === 'conversation'
                      ? 'border-violet-500 bg-violet-900/20 text-violet-200'
                      : 'border-amber-500 bg-amber-900/20 text-amber-200'
                    : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600'
                }`}>
                <span className="text-xl">{s.icon}</span>
                <span className="text-xs font-semibold">{SPEED_LABELS[s.id]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tipo de preguntas (examen y comprensión oral) */}
      {(mode === 'exam' || mode === 'listening') && (
        <div className="card space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('languages.questionTypeTitle')}</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setQuestionType('desarrollo')}
              className={`flex flex-col items-center gap-2 py-3 px-3 rounded-xl border-2 transition-all ${
                questionType === 'desarrollo'
                  ? 'border-primary-500 bg-primary-900/20 text-primary-200'
                  : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600'
              }`}>
              <span className="text-2xl">✍️</span>
              <span className="text-sm font-bold">{t('languages.devType')}</span>
              <span className="text-[10px] text-center leading-tight opacity-70">{t('languages.devTypeDesc')}</span>
            </button>
            <button onClick={() => setQuestionType('verdadero_falso')}
              className={`flex flex-col items-center gap-2 py-3 px-3 rounded-xl border-2 transition-all ${
                questionType === 'verdadero_falso'
                  ? 'border-primary-500 bg-primary-900/20 text-primary-200'
                  : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600'
              }`}>
              <span className="text-2xl">☑️</span>
              <span className="text-sm font-bold">{t('languages.vfType')}</span>
              <span className="text-[10px] text-center leading-tight opacity-70">{t('languages.vfTypeDesc')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Vocabulario del curso */}
      <div
        className={`card space-y-3 transition-colors ${vocabDragOver ? 'border-primary-500 bg-primary-900/10' : ''}`}
        onDragOver={e => { e.preventDefault(); setVocabDragOver(true) }}
        onDragLeave={() => setVocabDragOver(false)}
        onDrop={handleVocabDrop}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('languages.vocabTitle')}</p>
          <label className={`flex items-center gap-1.5 text-xs cursor-pointer transition-colors ${
            vocabLoading ? 'text-slate-600 pointer-events-none' : 'text-primary-400 hover:text-primary-300'
          }`}>
            {vocabLoading ? t('languages.uploading2') : t('languages.addFile')}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp" className="hidden"
              onChange={e => { if (e.target.files?.[0]) { uploadVocabPdf(e.target.files[0]); e.target.value = '' } }}
              disabled={vocabLoading} />
          </label>
        </div>
        {vocabPdfs.length === 0 ? (
          <div className={`flex flex-col items-center gap-1 py-4 rounded-xl border-2 border-dashed transition-colors ${
            vocabDragOver ? 'border-primary-500 text-primary-400' : 'border-slate-700 text-slate-600'
          }`}>
            <span className="text-2xl">📂</span>
            <p className="text-xs italic text-center px-2">
              {t('languages.dragHereVocab')}
            </p>
            <p className="text-[10px] text-slate-700">{t('languages.dragHintVocab')}</p>
          </div>
        ) : (
          <>
            <ul className="space-y-1.5">
              {vocabPdfs.map(f => (
                <li key={f.filename} className="rounded-lg border border-slate-700/60 overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-800/60">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm shrink-0">{/\.(jpe?g|png|webp|gif|bmp)$/i.test(f.filename) ? '🖼️' : '📄'}</span>
                      <span className="text-xs text-slate-300 truncate">{f.filename}</span>
                      {f.chars > 0 && <span className="text-[10px] text-slate-600 shrink-0">({Math.round(f.chars / 100) / 10}k)</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => togglePreview(f.filename)}
                        className="text-[10px] text-slate-500 hover:text-primary-400 transition-colors px-1">
                        {vocabPreviews[f.filename] === 'loading' ? '⏳' : vocabPreviews[f.filename] !== undefined && vocabPreviews[f.filename] !== null ? '🙈 ocultar' : '👁 ver'}
                      </button>
                      <button onClick={() => deleteVocabPdf(f.filename)}
                        className="text-xs text-slate-600 hover:text-red-400 transition-colors px-1">✕</button>
                    </div>
                  </div>
                  {vocabPreviews[f.filename] && vocabPreviews[f.filename] !== 'loading' && (
                    <div className="px-3 py-2 bg-slate-900/60 border-t border-slate-700/40 max-h-40 overflow-y-auto">
                      <p className="text-[10px] text-slate-400 whitespace-pre-wrap font-mono">{vocabPreviews[f.filename]}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {vocabDragOver && (
              <p className="text-xs text-primary-400 text-center">{t('languages.dropToAdd')}</p>
            )}
          </>
        )}
      </div>

      {/* Idioma */}
      <div className="card space-y-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('languages.langTitle')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {LANGUAGES.map(lang => (
            <button key={lang.id} onClick={() => setLanguage(lang.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 transition-all min-w-0 ${
                language === lang.id
                  ? mode === 'conversation' ? 'border-violet-500 bg-violet-900/20' : 'border-primary-500 bg-primary-900/20'
                  : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
              }`}>
              <span className="text-xl shrink-0">{lang.flag}</span>
              <span className="text-xs text-slate-300 font-medium truncate">{lang.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Nivel */}
      <div className="card space-y-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('languages.levelTitle')}</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {LEVELS.map(l => {
            const cls = LEVEL_CLS[l.id]
            const active = level === l.id
            return (
              <button key={l.id} onClick={() => setLevel(l.id)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all min-w-0 ${active ? cls.ring : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'}`}>
                <span className={`text-xl font-black ${active ? cls.text : 'text-slate-300'}`}>{l.id}</span>
                <span className="text-[9px] text-slate-400 text-center leading-tight px-1 break-words">{LEVEL_DESCS[l.id]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tema */}
      <div className="card space-y-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('languages.topicTitle')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TOPICS.filter(tp => !tp.vocabOnly).map(tp => (
            <button key={tp.id} onClick={() => setTopic(tp.id)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all min-w-0 ${
                topic === tp.id
                  ? mode === 'conversation' ? 'border-violet-500 bg-violet-900/20 text-violet-200' : 'border-primary-500 bg-primary-900/20 text-primary-200'
                  : 'border-slate-700 bg-slate-800/40 hover:border-slate-600 text-slate-300'
              }`}>
              <span className="text-base shrink-0">{tp.icon}</span>
              <span className="text-xs font-medium truncate">{TOPIC_LABELS[tp.id]}</span>
            </button>
          ))}
        </div>
        {/* Tab vocabulario: solo visible si hay archivos subidos */}
        {vocabPdfs.length > 0 && (
          <button onClick={() => setTopic('vocab')}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all ${
              topic === 'vocab'
                ? 'border-amber-500 bg-amber-900/20 text-amber-200'
                : 'border-amber-700/50 bg-amber-900/10 hover:border-amber-600 text-amber-400'
            }`}>
            <span className="text-base">📖</span>
            <span className="text-xs font-semibold">{t('languages.vocabCourseTopicLabel')}</span>
            <span className="text-[10px] text-amber-600 ml-1">({vocabPdfs.length} {vocabPdfs.length > 1 ? t('languages.topics.vocab') + 's' : t('languages.topics.vocab')})</span>
          </button>
        )}
      </div>

      {/* Botón */}
      {mode === 'exam' ? (
        <button onClick={startExam} disabled={loading}
          className="w-full py-4 rounded-2xl bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white font-bold text-lg transition-colors flex items-center justify-center gap-3">
          {loading ? <><span className="animate-spin text-xl">⏳</span> {t('languages.loadingExam')}</> : <>{langInfo?.flag} {t('languages.startExam')} {level}</>}
        </button>
      ) : mode === 'conversation' ? (
        <button onClick={startConversation} disabled={loading}
          className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-bold text-lg transition-colors flex items-center justify-center gap-3">
          {loading ? <><span className="animate-spin text-xl">⏳</span> {t('languages.loadingConv')}</> : <>{langInfo?.flag} {t('languages.startConv')} {level}</>}
        </button>
      ) : (
        <button onClick={startListening} disabled={loading}
          className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white font-bold text-lg transition-colors flex items-center justify-center gap-3">
          {loading ? <><span className="animate-spin text-xl">⏳</span> {t('languages.loadingListen')}</> : <>{langInfo?.flag} {t('languages.startListen')} {level}</>}
        </button>
      )}
    </div>
  )

  // ════════════════════════════════════════════════════════════════════════
  // PANTALLA: EXAMEN
  // ════════════════════════════════════════════════════════════════════════
  if (screen === 'exam') {
    const ex = exercises[currentIdx]
    if (!ex) return null
    const isLast  = currentIdx === exercises.length - 1
    const isFirst = currentIdx === 0
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{langInfo?.flag}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${levelCls.ring} ${levelCls.text}`}>{level}</span>
            <span className="text-xs text-slate-500">{topicInfo?.icon} {topicInfo?.label}</span>
          </div>
          <span className="text-sm text-slate-400"><span className="font-semibold text-slate-200">{currentIdx + 1}</span>/{exercises.length}</span>
        </div>
        <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
          <div className="h-full bg-primary-500 rounded-full transition-all duration-300" style={{ width: `${((currentIdx + 1) / exercises.length) * 100}%` }} />
        </div>
        <div className="card min-h-[260px]">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-3 font-semibold">{t(`languages.types.${ex.type}`) || ex.type}</p>
          <ExerciseCard key={ex.id} exercise={ex} answer={answers[ex.id] || ''} onAnswer={val => setAnswers(prev => ({ ...prev, [ex.id]: val }))} />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentIdx(i => i - 1)} disabled={isFirst} className="btn-secondary btn-sm px-4 disabled:opacity-30">{t('languages.prevQ')}</button>
          <div className="flex-1 flex gap-1 justify-center flex-wrap">
            {exercises.map((e, i) => (
              <button key={e.id} onClick={() => setCurrentIdx(i)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                  i === currentIdx ? 'bg-primary-600 text-white scale-110' : answers[e.id]?.trim() ? 'bg-emerald-800/60 text-emerald-300' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                }`}>{i + 1}</button>
            ))}
          </div>
          {isLast
            ? <button onClick={() => submitExam(false)} disabled={evaluating} className="btn-primary btn-sm px-4">{evaluating ? '⏳' : t('languages.submitExamBtn')}</button>
            : <button onClick={() => setCurrentIdx(i => i + 1)} className="btn-primary btn-sm px-4">{t('languages.nextQ')}</button>
          }
        </div>
        <p className="text-center text-xs text-slate-500">
          {answeredCount}/{exercises.length} {t('languages.answered')}
          {answeredCount === exercises.length && <span className="text-emerald-500"> · {t('languages.readyToSubmit')}</span>}
        </p>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // PANTALLA: RESULTADOS EXAMEN
  // ════════════════════════════════════════════════════════════════════════
  if (screen === 'results' && evaluation) {
    const pct   = evaluation.max_score > 0 ? Math.round((evaluation.overall_score / evaluation.max_score) * 100) : 0
    const grade = pct >= 90 ? { label: t('languages.gradeOutstanding'), color: 'text-emerald-400' }
                : pct >= 70 ? { label: t('languages.gradeGood'),        color: 'text-blue-400' }
                : pct >= 50 ? { label: t('languages.gradePass'),        color: 'text-amber-400' }
                :             { label: t('languages.gradeFail'),        color: 'text-red-400' }
    const catLabels = { grammar: t('languages.catGrammar'), vocabulary: t('languages.catVocabulary'), accuracy: t('languages.catAccuracy') }
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        <div className="card text-center space-y-4 py-6">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <span>{langInfo?.flag}</span><span>{langInfo?.label}</span>
            <span>·</span><span className={`font-bold ${levelCls.text}`}>{level}</span>
            <span>·</span><span>{topicInfo?.icon} {topicInfo?.label}</span>
          </div>
          <div>
            <span className={`text-7xl font-black tabular-nums ${grade.color}`}>{Number(evaluation.overall_score).toFixed(1)}</span>
            <span className="text-3xl text-slate-500 font-bold">/{evaluation.max_score}</span>
          </div>
          <p className={`text-xl font-bold ${grade.color}`}>{grade.label}</p>
          <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">{evaluation.feedback}</p>
          {evaluation.categories && (
            <div className="grid grid-cols-3 gap-4 mt-2 pt-4 border-t border-slate-700/60">
              {Object.entries(evaluation.categories).map(([cat, score]) => (
                <div key={cat} className="space-y-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">{catLabels[cat] || cat}</p>
                  <p className="text-2xl font-bold text-slate-200">{score}<span className="text-sm text-slate-500">/10</span></p>
                  <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-500 rounded-full" style={{ width: `${score * 10}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">{t('languages.exerciseDetail')}</p>
          {exercises.map((ex, i) => {
            const result = evaluation.results?.find(r => r.id === ex.id) ?? evaluation.results?.[i]
            return <ExerciseResult key={ex.id} exercise={ex} result={result} index={i} />
          })}
        </div>
        <div className="flex gap-3">
          <button onClick={() => setScreen('config')} className="flex-1 btn-secondary py-3 font-semibold">{t('languages.newExamBtn')}</button>
          <button onClick={() => { setAnswers({}); setCurrentIdx(0); setScreen('exam') }} className="flex-1 btn-secondary py-3 font-semibold">{t('languages.repeatExamBtn')}</button>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // PANTALLA: CONVERSACIÓN ORAL
  // ════════════════════════════════════════════════════════════════════════
  if (screen === 'conversation') {
    const busy = processing || speaking || connecting
    const micActive = recording || speaking

    return (
      <div className="flex flex-col h-full max-h-[calc(100vh-4rem)]">

        {/* Cabecera */}
        <div className="shrink-0 px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">{langInfo?.flag}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 ${levelCls.ring} ${levelCls.text}`}>{level}</span>
            <span className="text-xs text-slate-500 truncate">{topicInfo?.icon} {topicInfo?.label}</span>
            {convTurnCount > 0 && <span className="text-[10px] text-slate-600 shrink-0">· {convTurnCount} {convTurnCount !== 1 ? t('languages.turnsPlural') : t('languages.turns')}</span>}
          </div>
          <button onClick={endConversation} disabled={processing && convMessages.filter(m => m.role === 'user').length === 0}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-800/40 hover:bg-violet-700/50 border border-violet-700/50 text-violet-300 text-xs font-semibold transition-all disabled:opacity-40">
            {t('languages.endConv')}
          </button>
        </div>

        {/* Escenario */}
        {convScenario && (
          <div className="shrink-0 px-4 py-2.5 bg-slate-800/40 border-b border-slate-800/60">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{t('languages.scenario')}</p>
            <p className="text-xs text-slate-300 leading-relaxed">{convScenario}</p>
          </div>
        )}

        {/* Chat */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
          {convMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <span className="shrink-0 text-base mb-0.5">{msg.role === 'assistant' ? '🤖' : '🙋'}</span>
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'assistant'
                    ? 'bg-slate-700/60 border border-slate-600/40 text-slate-100 rounded-bl-sm'
                    : 'bg-violet-700/50 border border-violet-600/40 text-violet-50 rounded-br-sm'
                }`}>{msg.content}</div>
              </div>
            </div>
          ))}
          {processing && (
            <div className="flex justify-start">
              <div className="flex items-end gap-2">
                <span className="text-base mb-0.5">🤖</span>
                <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-slate-700/60 border border-slate-600/40">
                  <div className="flex gap-1.5 items-center">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Panel inferior */}
        <div className="shrink-0 px-4 py-3 border-t border-slate-800 space-y-2 bg-slate-900/80">

          {/* Visualizador de voz */}
          {recording && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                <canvas ref={canvasRef} width={340} height={28} className="flex-1 h-7 rounded-lg bg-slate-900/60" />
                <span className="text-[10px] text-slate-500 shrink-0 w-20 text-right">
                  {silencePct > 0 ? t('languages.sendingMsg') : t('languages.listeningMsg')}
                </span>
              </div>
              {silencePct > 0 && (
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${silencePct}%` }} />
                </div>
              )}
            </div>
          )}

          {/* Estado cuando habla el tutor */}
          {speaking && !recording && (
            <div className="flex items-center gap-2 justify-center py-1">
              <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
              <span className="text-xs text-violet-300">{t('languages.tutorSpeaking')}</span>
            </div>
          )}

          {/* Fila mic + texto */}
          <div className="flex gap-2 items-center">
            <button onClick={toggleMic} disabled={processing || connecting}
              className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-lg transition-all disabled:opacity-40 ${
                recording  ? 'bg-red-600 text-white ring-2 ring-red-500/40' :
                connecting ? 'bg-amber-500 text-white ring-2 ring-amber-400/50 animate-pulse' :
                speaking   ? 'bg-violet-600 text-white ring-2 ring-violet-500/40' :
                'btn-secondary'
              }`}
              title={connecting ? t('languages.activatingMic') : recording ? t('languages.stopRecording') : speaking ? t('languages.interruptTutor') : t('languages.activateMic')}>
              {recording ? '⏹' : connecting ? '⏳' : speaking ? '🔊' : '🎙️'}
            </button>
            <input
              type="text"
              className="input flex-1 text-sm"
              placeholder={t('languages.writeInLang', { lang: langInfo?.label || '' })}
              value={convTextInput}
              onChange={e => setConvTextInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTextTurn() } }}
              disabled={busy || recording}
            />
            <button onClick={sendTextTurn} disabled={busy || recording || !convTextInput.trim()}
              className="btn-primary w-10 h-10 shrink-0 flex items-center justify-center text-lg disabled:opacity-40">→</button>
          </div>
          <p className="text-[10px] text-slate-600 text-center">
            {t('languages.autoMic')}
          </p>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // PANTALLA: RESULTADOS CONVERSACIÓN
  // ════════════════════════════════════════════════════════════════════════
  if (screen === 'conv_results' && convEval) {
    const overall = Number(convEval.overall_score ?? 0)
    const grade = overall >= 9 ? { label: t('languages.convGradeExcellent'), color: 'text-emerald-400' }
                : overall >= 7 ? { label: t('languages.convGradeVeryGood'),  color: 'text-blue-400' }
                : overall >= 5 ? { label: t('languages.convGradeGood'),      color: 'text-amber-400' }
                :                { label: t('languages.convGradePractice'),  color: 'text-red-400' }
    const catLabels = { grammar: t('languages.catGrammar'), vocabulary: t('languages.catVocabulary'), fluency: t('languages.catFluency'), coherence: t('languages.catCoherence') }
    const catIcons  = { grammar: '📐', vocabulary: '📖', fluency: '🌊', coherence: '🔗' }

    return (
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        <div className="card text-center space-y-3 py-6">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <span>{langInfo?.flag}</span><span>{langInfo?.label}</span>
            <span>·</span><span className={`font-bold ${levelCls.text}`}>{level}</span>
            <span>·</span><span>{topicInfo?.icon} {topicInfo?.label}</span>
            <span>·</span><span>🎙️ {convTurnCount} {convTurnCount !== 1 ? t('languages.turnsPlural') : t('languages.turns')}</span>
          </div>
          <div>
            <span className={`text-7xl font-black tabular-nums ${grade.color}`}>{overall.toFixed(1)}</span>
            <span className="text-3xl text-slate-500 font-bold">/10</span>
          </div>
          <p className={`text-xl font-bold ${grade.color}`}>{grade.label}</p>
          {convEval.feedback && <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">{convEval.feedback}</p>}
          {convEval.categories && (
            <div className="grid grid-cols-4 gap-3 mt-2 pt-4 border-t border-slate-700/60">
              {Object.entries(convEval.categories).map(([cat, score]) => (
                <div key={cat} className="space-y-1.5">
                  <p className="text-xs">{catIcons[cat] || '•'}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider leading-tight">{catLabels[cat] || cat}</p>
                  <p className="text-2xl font-bold text-slate-200">{score}<span className="text-xs text-slate-500">/10</span></p>
                  <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500 rounded-full" style={{ width: `${score * 10}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {convEval.strengths?.length > 0 && (
          <div className="card space-y-2">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">{t('languages.strengths')}</p>
            <ul className="space-y-1">
              {convEval.strengths.map((s, i) => (
                <li key={i} className="text-sm text-slate-300 flex items-start gap-2"><span className="text-emerald-500 mt-0.5 shrink-0">·</span>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {convEval.suggestions?.length > 0 && (
          <div className="card space-y-2">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">{t('languages.improve')}</p>
            <ul className="space-y-1">
              {convEval.suggestions.map((s, i) => (
                <li key={i} className="text-sm text-slate-300 flex items-start gap-2"><span className="text-amber-500 mt-0.5 shrink-0">·</span>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {convEval.errors?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">{t('languages.errorsFound')}</p>
            {convEval.errors.map((err, i) => (
              <div key={i} className="rounded-xl border border-red-800/40 bg-red-950/10 p-4 space-y-1.5">
                <div className="flex items-start gap-2.5"><span className="text-red-400 font-mono text-sm shrink-0">✗</span><span className="text-red-300 text-sm font-medium">{err.said}</span></div>
                <div className="flex items-start gap-2.5 pl-5"><span className="text-emerald-400 font-mono text-sm shrink-0">✓</span><span className="text-emerald-300 text-sm font-medium">{err.correction}</span></div>
                {err.explanation && <p className="text-xs text-slate-500 italic pl-5">{err.explanation}</p>}
              </div>
            ))}
          </div>
        )}

        {convEval.errors?.length === 0 && (
          <div className="card text-center py-4">
            <p className="text-emerald-400 font-semibold">{t('languages.noErrors')}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => { setScreen('config'); setMode('conversation') }} className="flex-1 btn-secondary py-3 font-semibold">{t('languages.newConvBtn')}</button>
          <button onClick={() => { activeRef.current = false; startConversation() }}
            className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors text-sm">{t('languages.repeatConvBtn')}</button>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // PANTALLA: COMPRENSIÓN ORAL
  // ════════════════════════════════════════════════════════════════════════
  if (screen === 'listening' && listenExercise) {
    const playsLeft = MAX_PLAYS - listenPlays
    const canPlay   = !speaking && playsLeft > 0
    const hasPlayed = listenPlays > 0

    return (
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        {/* Cabecera */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{langInfo?.flag}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${levelCls.ring} ${levelCls.text}`}>{level}</span>
            <span className="text-xs text-slate-500">{topicInfo?.icon} {topicInfo?.label}</span>
          </div>
          <button onClick={() => { stopListenAudio(); setScreen('config') }}
            className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors">
            {t('languages.back')}
          </button>
        </div>

        {/* Sección de reproducción */}
        <div className="card">
          <style>{`@keyframes langBar { from{transform:scaleY(0.4)} to{transform:scaleY(1.5)} }`}</style>

          {speaking ? (
            /* Audio reproduciéndose */
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="relative">
                <span className="text-5xl">{langInfo?.flag}</span>
                <span className="absolute -bottom-1 -right-2 text-xl">🎧</span>
              </div>
              <div className="flex items-end gap-1 h-8">
                {Array.from({length: 14}, (_, i) => (
                  <div key={i} className="w-1.5 rounded-full bg-amber-400"
                    style={{
                      height: `${16 + Math.sin(i * 0.6) * 10}px`,
                      animation: `langBar 0.7s ease-in-out ${i * 0.055}s infinite alternate`,
                    }} />
                ))}
              </div>
              <p className="text-sm font-semibold text-amber-300">{t('languages.playingAudio')}</p>
              <button onClick={stopListenAudio}
                className="text-xs text-slate-500 hover:text-slate-300 underline transition-colors">
                {t('languages.stopAudioBtn')}
              </button>
            </div>
          ) : (
            /* Botón de reproducir */
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-slate-200">
                  {!hasPlayed ? t('languages.listenFirst') : t('languages.listenAgain')}
                </p>
                <p className="text-xs text-slate-500">
                  {playsLeft > 0
                    ? playsLeft === 1 ? t('languages.playsLeftOne', { count: playsLeft }) : t('languages.playsLeftOther', { count: playsLeft })
                    : t('languages.playsMax')}
                </p>
              </div>
              <button
                onClick={() => speakListenText(listenExercise.texto)}
                disabled={!canPlay}
                className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                  canPlay
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}>
                {listenPlays === 0 ? t('languages.playBtn') : t('languages.repeatBtn')}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${canPlay ? 'bg-amber-800/60' : 'bg-slate-600'}`}>
                  {playsLeft}/{MAX_PLAYS}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Nota: latencia TTS */}
        <p className="text-[11px] text-slate-600 text-center -mt-2">
          {t('languages.ttsLatency')}
        </p>

        {/* Aviso: escucha primero */}
        {!hasPlayed && (
          <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 p-3 flex gap-2 items-center">
            <span className="text-lg">💡</span>
            <p className="text-xs text-amber-300">
              {t('languages.pressPlayHint', { lang: langInfo?.label })}
            </p>
          </div>
        )}

        {/* Preguntas (siempre visibles — ayuda a saber qué escuchar) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('languages.comprehensionQs')}</p>
            <p className="text-[10px] text-slate-600">{t('languages.answerIn', { lang: langInfo?.label })}</p>
          </div>

          {listenExercise.preguntas.map((q, i) => (
            <div key={i} className="space-y-2">
              <label className="block text-sm font-medium text-slate-200">
                <span className="text-amber-400 mr-1">{i + 1}.</span>{q}
              </label>

              {questionType === 'verdadero_falso' ? (
                /* Botones V/F + justificación */
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {['v', 'f'].map(choice => {
                      const sel = vfSelections[i]?.vf === choice
                      return (
                        <button key={choice} onClick={() => hasPlayed && updateVF(i, 'vf', choice)}
                          disabled={!hasPlayed}
                          className={`flex-1 py-2 rounded-xl border-2 font-semibold text-sm transition-all disabled:opacity-40 ${
                            sel
                              ? choice === 'v'
                                ? 'border-emerald-500 bg-emerald-900/30 text-emerald-200'
                                : 'border-red-500 bg-red-900/20 text-red-200'
                              : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600'
                          }`}>
                          {choice === 'v' ? `✅ ${t('languages.trueFalseTrue')}` : `❌ ${t('languages.trueFalseFalse')}`}
                        </button>
                      )
                    })}
                  </div>
                  <textarea
                    className="input w-full text-sm resize-none"
                    placeholder={hasPlayed ? t('languages.vfJustif', { lang: langInfo?.label }) : t('languages.listenFirstPlaceholder')}
                    rows={2}
                    disabled={!hasPlayed || !vfSelections[i]?.vf}
                    value={vfSelections[i]?.justif || ''}
                    onChange={e => updateVF(i, 'justif', e.target.value)}
                  />
                </div>
              ) : (
                /* Respuesta de desarrollo */
                <textarea
                  className="input w-full text-sm resize-none"
                  placeholder={hasPlayed ? t('languages.answerInLang', { lang: langInfo?.label }) : t('languages.listenFirstPlaceholder')}
                  rows={2}
                  value={listenAnswers[i] || ''}
                  onChange={e => {
                    const next = [...listenAnswers]
                    next[i] = e.target.value
                    setListenAnswers(next)
                  }}
                />
              )}
            </div>
          ))}

          <button
            onClick={evaluateListening}
            disabled={listenEvaluating || !hasPlayed}
            className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2">
            {listenEvaluating
              ? t('languages.evaluatingBtn')
              : !hasPlayed
                ? t('languages.listenFirstBtn')
                : t('languages.submitAnswersBtn')}
          </button>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // PANTALLA: RESULTADOS COMPRENSIÓN ORAL
  // ════════════════════════════════════════════════════════════════════════
  if (screen === 'listening_results' && listenFeedback) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <span>{langInfo?.flag}</span><span>{langInfo?.label}</span>
          <span>·</span><span className={`font-bold ${levelCls.text}`}>{level}</span>
          <span>·</span><span>🎧 {t('languages.listenHeader')}</span>
        </div>

        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎓</span>
            <div>
              <p className="font-semibold text-slate-100">{t('languages.exerciseEval')}</p>
              <p className="text-xs text-slate-500">{langInfo?.label} · {t('languages.levelLabel')} {level} · {topicInfo?.icon} {topicInfo?.label}</p>
            </div>
          </div>
          <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap bg-slate-800/60 rounded-xl p-4 border border-slate-700">
            {listenFeedback}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => { setScreen('config'); setMode('listening') }}
            className="flex-1 btn-secondary py-3 font-semibold">{t('languages.newExerciseBtn')}</button>
          <button onClick={startListening} disabled={loading}
            className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white font-semibold transition-colors text-sm">
            {loading ? <><span className="animate-spin">⏳</span> {t('languages.loadingListen')}</> : t('languages.repeatExerciseBtn')}
          </button>
        </div>
      </div>
    )
  }

  return null
}
