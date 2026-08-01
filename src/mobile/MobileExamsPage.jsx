import { useState, useEffect, useCallback } from 'react'
import { api, useAppStore } from '../store/appStore'
import { scheduleExamNotifications } from './notificationService'
import MobileTabBar from './MobileTabBar'
import {
  IconCalendar, IconX, IconBooks, IconLoader2, IconCircleCheck,
  IconAlertTriangle, IconFileText, IconTrash,
} from '@tabler/icons-react'

function daysUntil(examDate) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(examDate)
  d.setHours(0, 0, 0, 0)
  return Math.round((d - today) / 86400000)
}

function daysLabel(n) {
  if (n < 0)  return 'Pasado'
  if (n === 0) return '¡Hoy!'
  if (n === 1) return 'Mañana'
  return `En ${n} días`
}

function cardStyle(n) {
  if (n <= 0) return 'bg-slate-800/40 border border-slate-700/40 opacity-60'
  if (n === 1) return 'bg-red-900/40 border border-red-700/60'
  if (n <= 3)  return 'bg-amber-900/30 border border-amber-700/40'
  if (n <= 7)  return 'bg-yellow-900/20 border border-yellow-800/30'
  return 'bg-slate-800/60 border border-slate-700/40'
}

function urgIcon(n) {
  if (n <= 0) return IconCircleCheck
  if (n === 1) return IconAlertTriangle
  if (n <= 3)  return IconAlertTriangle
  return IconCalendar
}

function daysColor(n) {
  if (n <= 0) return 'text-slate-500'
  if (n <= 1) return 'text-red-400 font-semibold'
  if (n <= 3) return 'text-amber-400 font-medium'
  if (n <= 7) return 'text-yellow-400'
  return 'text-slate-400'
}

const DEFAULT_COLOR = '#8b5cf6'

export default function MobileExamsPage() {
  const [exams, setExams]       = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle]       = useState('')
  const [date, setDate]         = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [customColor, setCustomColor] = useState(false)
  const [color, setColor]       = useState(DEFAULT_COLOR)
  const [saving, setSaving]     = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const { addToast } = useAppStore()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api('GET', '/exams/reminders')
      const items = res.items || []
      setExams(items)
      scheduleExamNotifications(items).catch(() => {})
    } catch {
      addToast('Error al cargar los exámenes', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api('GET', '/subjects').then(res => setSubjects(res.items || [])).catch(() => {})
  }, [])

  async function addExam(e) {
    e.preventDefault()
    if (!title.trim() || !date) return
    setSaving(true)
    try {
      await api('POST', '/exams/reminders', {
        title: title.trim(), exam_date: date,
        subject_id: subjectId ? (isNaN(Number(subjectId)) ? subjectId : Number(subjectId)) : null,
        color: customColor ? color : null,
      })
      setTitle('')
      setDate('')
      setSubjectId('')
      setCustomColor(false)
      setColor(DEFAULT_COLOR)
      setShowForm(false)
      await load()
      addToast('Examen añadido — recordatorios programados', 'success')
    } catch {
      addToast('Error al añadir el examen', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function deleteExam(id) {
    setDeleting(id)
    try {
      await api('DELETE', `/exams/reminders/${id}`)
      const updated = exams.filter(e => e.id !== id)
      setExams(updated)
      scheduleExamNotifications(updated).catch(() => {})
      addToast('Examen eliminado', 'success')
    } catch {
      addToast('Error al eliminar', 'error')
    } finally {
      setDeleting(null)
      setConfirmId(null)
    }
  }

  // Ordenar: primero los próximos, al final los pasados
  const sorted = [...exams].sort((a, b) => new Date(a.exam_date) - new Date(b.exam_date))

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col pb-20">
      {/* Cabecera */}
      <div className="px-5 pt-14 pb-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2"><IconCalendar size={22} /> Mis exámenes</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {loading ? 'Cargando...' : `${exams.length} registrados`}
          </p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className={`w-10 h-10 rounded-full text-white text-2xl flex items-center justify-center transition-colors
            ${showForm ? 'bg-slate-600 active:bg-slate-500' : 'bg-primary-600 active:bg-primary-700'}`}
        >
          {showForm ? <IconX size={20} /> : '+'}
        </button>
      </div>

      {/* Formulario añadir */}
      {showForm && (
        <form onSubmit={addExam} className="px-5 py-4 bg-slate-800/60 border-b border-slate-700 space-y-3">
          <input
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Nombre del examen (ej: Matemáticas tema 3)"
            className="w-full px-4 py-3 rounded-xl bg-slate-700 text-slate-100 placeholder-slate-500
                       border border-slate-600 focus:border-primary-500 outline-none text-sm"
          />
          <input
            required
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-slate-700 text-slate-100
                       border border-slate-600 focus:border-primary-500 outline-none text-sm"
          />
          {subjects.length > 0 && (
            <div className="bg-slate-700 rounded-xl px-4 py-3 flex items-center gap-3 border border-slate-600">
              <IconBooks size={16} className="text-slate-400 shrink-0" />
              <select
                value={subjectId}
                onChange={e => {
                  setSubjectId(e.target.value)
                  if (!customColor) {
                    const subj = subjects.find(s => String(s.id) === e.target.value)
                    setColor(subj?.color || DEFAULT_COLOR)
                  }
                }}
                className="flex-1 bg-transparent text-slate-100 outline-none text-sm"
              >
                <option value="" className="bg-slate-700">Sin asignatura</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id} className="bg-slate-700">{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="bg-slate-700 rounded-xl px-4 py-3 flex items-center gap-3 border border-slate-600">
            <label className="flex items-center gap-2 flex-1 text-sm text-slate-300">
              <input type="checkbox" checked={customColor}
                onChange={e => {
                  setCustomColor(e.target.checked)
                  if (!e.target.checked) {
                    const subj = subjects.find(s => String(s.id) === subjectId)
                    setColor(subj?.color || DEFAULT_COLOR)
                  }
                }}
                className="w-4 h-4" />
              Personalizar color
            </label>
            {customColor && (
              <input type="color" value={color} onChange={e => setColor(e.target.value)}
                className="w-9 h-9 rounded cursor-pointer bg-transparent border-0" title="Color" />
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-xl bg-primary-600 active:bg-primary-700 text-white
                       font-semibold disabled:opacity-50 transition-colors"
          >
            {saving
              ? <span className="flex items-center justify-center gap-2"><IconLoader2 size={16} className="animate-spin" /> Guardando...</span>
              : <span className="flex items-center justify-center gap-2"><IconCircleCheck size={16} /> Añadir examen</span>}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <IconCalendar size={44} className="text-slate-600 animate-pulse" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
          <IconFileText size={64} className="text-slate-700" />
          <p className="text-slate-200 font-semibold text-lg">Sin exámenes registrados</p>
          <p className="text-slate-500 text-sm leading-relaxed">
            Añade tus próximos exámenes y recibirás recordatorios automáticos
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-1 px-6 py-3 rounded-xl bg-primary-600 active:bg-primary-700 text-white font-medium text-sm"
          >
            + Añadir primer examen
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {sorted.map(exam => {
            const n = daysUntil(exam.exam_date)
            const dotColor = exam.color || exam.subject_color || DEFAULT_COLOR
            return (
              <div key={exam.id} className={`rounded-2xl px-4 py-3.5 flex items-center gap-3 ${cardStyle(n)}`}
                style={{ borderLeftWidth: 4, borderLeftColor: dotColor }}>
                {(() => { const UIcon = urgIcon(n); return <UIcon size={22} className="shrink-0" /> })()}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-100 truncate">{exam.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(exam.exam_date).toLocaleDateString('es-ES', {
                      weekday: 'short', day: 'numeric', month: 'long',
                    })}
                  </p>
                  <p className={`text-xs mt-0.5 ${daysColor(n)}`}>
                    {daysLabel(n)}
                  </p>
                  {exam.subject_name && (
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: dotColor }} />
                      {exam.subject_name}
                    </p>
                  )}
                </div>

                {confirmId === exam.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => deleteExam(exam.id)}
                      disabled={deleting === exam.id}
                      className="px-3 py-1.5 rounded-lg bg-red-600 active:bg-red-700 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      {deleting === exam.id ? '...' : 'Borrar'}
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="px-3 py-1.5 rounded-lg bg-slate-700 active:bg-slate-600 text-slate-300 text-xs"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(exam.id)}
                    className="shrink-0 p-2 text-slate-600 active:text-red-400 transition-colors"
                  >
                    <IconTrash size={18} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <MobileTabBar />
    </div>
  )
}
