import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, apiUpload, useAppStore } from '../store/appStore'
import {
  IconArrowLeft, IconMicrophone2, IconPlayerStop, IconVolumeOff, IconBooks,
  IconFolder, IconTrash, IconCircleCheck, IconLoader2,
} from '@tabler/icons-react'

function formatTime(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function MobileRecordPage() {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds]     = useState(0)
  const [done, setDone]           = useState(false)
  const [loading, setLoading]     = useState(false)
  const [title, setTitle]         = useState('')
  const [limpiarRuido, setLimpiarRuido] = useState(false)
  const [subjects, setSubjects] = useState([])
  const [subjectId, setSubjectId] = useState('')
  const [topics, setTopics]     = useState([])
  const [topicId, setTopicId]   = useState('')
  const mediaRef  = useRef(null)
  const chunksRef = useRef([])
  const timerRef  = useRef(null)
  const { addToast } = useAppStore()
  const navigate = useNavigate()

  // Cargar asignaturas solo una vez, no bloquea la grabación si falla
  useEffect(() => {
    api('GET', '/subjects').then(res => setSubjects(res.items || [])).catch(() => {})
  }, [])

  // Al elegir asignatura, cargar sus temas (si tiene alguno)
  useEffect(() => {
    setTopicId('')
    if (!subjectId) { setTopics([]); return }
    api('GET', `/subjects/${subjectId}/topics`)
      .then(res => setTopics(res.items || []))
      .catch(() => setTopics([]))
  }, [subjectId])

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.start(1000)
      mediaRef.current = mr
      setSeconds(0)
      setDone(false)
      setRecording(true)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } catch {
      addToast('No se pudo acceder al micrófono', 'error')
    }
  }

  const stop = () => {
    clearInterval(timerRef.current)
    mediaRef.current?.stop()
    mediaRef.current?.stream.getTracks().forEach(t => t.stop())
    setRecording(false)
    setDone(true)
  }

  const guardar = async () => {
    if (!chunksRef.current.length) return
    setLoading(true)
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const form = new FormData()
      form.append('audio', blob, 'apuntes.webm')
      form.append('title', title.trim() || 'Apuntes de voz')
      form.append('clean', limpiarRuido ? 'true' : 'false')
      if (topicId) form.append('topic_id', topicId)
      else if (subjectId) form.append('subject_id', subjectId)
      await apiUpload('/audio/transcribe-mobile', form)
      addToast('¡Apuntes transcritos y guardados!', 'success')
      navigate('/')
    } catch (e) {
      if (!e.quotaExceeded) addToast('Error al procesar el audio', 'error')
    } finally {
      setLoading(false)
    }
  }

  const descartar = () => {
    chunksRef.current = []
    setDone(false)
    setSeconds(0)
    setTitle('')
    setSubjectId('')
    setTopicId('')
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Cabecera */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-5">
        <button onClick={() => navigate('/')} className="text-slate-400 p-1"><IconArrowLeft size={22} /></button>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2"><IconMicrophone2 size={20} /> Grabar apuntes</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
        {/* Contador */}
        <div className={`text-7xl font-mono font-bold tabular-nums
                         ${recording ? 'text-red-400' : 'text-slate-500'}`}>
          {formatTime(seconds)}
        </div>

        {/* Ondas animadas mientras graba */}
        {recording && (
          <div className="flex items-end gap-1 h-10">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="w-2 bg-red-400 rounded-full animate-pulse"
                style={{ height: `${16 + (i % 3) * 10}px`, animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        )}

        {/* Botón principal de grabación */}
        {!done && (
          <button
            onClick={recording ? stop : start}
            className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl
                         shadow-2xl active:scale-95 transition-all
                         ${recording ? 'bg-red-600 active:bg-red-700' : 'bg-primary-600 active:bg-primary-700'}`}
          >
            {recording ? <IconPlayerStop size={40} /> : <IconMicrophone2 size={40} />}
          </button>
        )}

        {/* Después de parar: título + botones */}
        {done && (
          <div className="w-full space-y-4">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Nombre de los apuntes (opcional)"
              className="w-full px-4 py-4 rounded-xl bg-slate-800 text-slate-100 placeholder-slate-500
                         border border-slate-700 focus:border-primary-500 outline-none text-base"
            />

            <button
              type="button"
              onClick={() => setLimpiarRuido(v => !v)}
              disabled={loading}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-colors disabled:opacity-50
                ${limpiarRuido ? 'bg-primary-600/15 border-primary-600' : 'bg-slate-800 border-slate-700'}`}
            >
              <IconVolumeOff size={20} className="shrink-0 text-slate-400" />
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-slate-100">Quitar ruido e interrupciones</p>
                <p className="text-xs text-slate-500">Para grabaciones largas en ambientes ruidosos</p>
              </div>
              <div className={`w-11 h-6 rounded-full shrink-0 relative transition-colors
                ${limpiarRuido ? 'bg-primary-500' : 'bg-slate-600'}`}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform
                  ${limpiarRuido ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            </button>

            {subjects.length > 0 && (
              <div className="bg-slate-800 rounded-2xl px-4 py-3 flex items-center gap-3 border border-slate-700">
                <IconBooks size={16} className="text-slate-400 shrink-0" />
                <select
                  value={subjectId}
                  onChange={e => setSubjectId(e.target.value)}
                  disabled={loading}
                  className="flex-1 bg-transparent text-slate-100 outline-none text-sm"
                >
                  <option value="" className="bg-slate-800">Sin asignatura</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id} className="bg-slate-800">{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {subjectId && topics.length > 0 && (
              <div className="bg-slate-800 rounded-2xl px-4 py-3 flex items-center gap-3 border border-slate-700">
                <IconFolder size={16} className="text-slate-400 shrink-0" />
                <select
                  value={topicId}
                  onChange={e => setTopicId(e.target.value)}
                  disabled={loading}
                  className="flex-1 bg-transparent text-slate-100 outline-none text-sm"
                >
                  <option value="" className="bg-slate-800">Sin tema (suelto)</option>
                  {topics.map(topic => (
                    <option key={topic.id} value={topic.id} className="bg-slate-800">{topic.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={guardar}
              disabled={loading}
              className="w-full py-5 rounded-2xl bg-primary-600 text-white font-bold text-lg
                         active:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {loading
                ? <span className="flex items-center justify-center gap-2"><IconLoader2 size={18} className="animate-spin" /> {limpiarRuido ? 'Transcribiendo y limpiando...' : 'Transcribiendo...'}</span>
                : <span className="flex items-center justify-center gap-2"><IconCircleCheck size={18} /> Guardar y transcribir</span>}
            </button>
            <button
              onClick={descartar}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-slate-700 text-slate-400 font-medium
                         active:bg-slate-600 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              <IconTrash size={16} /> Descartar
            </button>
          </div>
        )}

        {!recording && !done && (
          <p className="text-slate-500 text-sm text-center max-w-xs">
            Pulsa para empezar. Habla despacio y con claridad.
          </p>
        )}
      </div>
    </div>
  )
}
