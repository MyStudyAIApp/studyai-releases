import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore, api } from '../store/appStore'
import Modal from '../components/UI/Modal'
import Spinner from '../components/UI/Spinner'

const DEFAULT_COLOR = '#8b5cf6'

function toKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function buildGrid(monthDate) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  // Lunes = 0 ... Domingo = 6
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7
  const gridStart = new Date(year, month, 1 - firstWeekday)

  const cells = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    cells.push(d)
  }
  return cells
}

export default function CalendarPage() {
  const { t } = useTranslation()
  const { backendReady } = useAppStore()

  const [monthDate, setMonthDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [reminders, setReminders] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formSubjectId, setFormSubjectId] = useState('')
  const [customColor, setCustomColor] = useState(false)
  const [formColor, setFormColor] = useState(DEFAULT_COLOR)
  const [saving, setSaving] = useState(false)

  function loadData() {
    return Promise.allSettled([
      api('GET', '/exams/reminders'),
      api('GET', '/subjects'),
    ]).then(([rems, subs]) => {
      const r = rems.status === 'fulfilled' ? rems.value : {}
      const s = subs.status === 'fulfilled' ? subs.value : {}
      setReminders(r.items || [])
      setSubjects(s.items || (Array.isArray(s) ? s : []))
    })
  }

  useEffect(() => {
    if (!backendReady) return
    setLoading(true)
    loadData().finally(() => setLoading(false))
  }, [backendReady])

  const cells = useMemo(() => buildGrid(monthDate), [monthDate])

  const remindersByDay = useMemo(() => {
    const map = {}
    for (const r of reminders) {
      const d = new Date(r.exam_date)
      const key = toKey(d)
      if (!map[key]) map[key] = []
      map[key].push(r)
    }
    return map
  }, [reminders])

  const todayKey = toKey(new Date())

  function eventColor(r) {
    return r.color || r.subject_color || DEFAULT_COLOR
  }

  function openAddModal(date) {
    setEditingId(null)
    setFormTitle('')
    setFormDate(toKey(date))
    setFormSubjectId('')
    setCustomColor(false)
    setFormColor(DEFAULT_COLOR)
    setModalOpen(true)
  }

  function openEditModal(r) {
    setEditingId(r.id)
    setFormTitle(r.title)
    setFormDate(toKey(new Date(r.exam_date)))
    setFormSubjectId(r.subject_id ? String(r.subject_id) : '')
    setCustomColor(!!r.color)
    setFormColor(r.color || r.subject_color || DEFAULT_COLOR)
    setModalOpen(true)
  }

  function handleSubjectChange(id) {
    setFormSubjectId(id)
    if (!customColor) {
      const subj = subjects.find(s => String(s.id) === String(id))
      setFormColor(subj?.color || DEFAULT_COLOR)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!formTitle.trim() || !formDate) return
    setSaving(true)
    try {
      const payload = {
        title: formTitle.trim(),
        exam_date: formDate,
        subject_id: formSubjectId ? (isNaN(Number(formSubjectId)) ? formSubjectId : Number(formSubjectId)) : null,
        color: customColor ? formColor : null,
      }
      if (editingId) {
        await api('PATCH', `/exams/reminders/${editingId}`, payload)
      } else {
        await api('POST', '/exams/reminders', payload)
      }
      await loadData()
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editingId) return
    setSaving(true)
    try {
      await api('DELETE', `/exams/reminders/${editingId}`)
      await loadData()
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const monthLabel = monthDate.toLocaleDateString('es', { month: 'long', year: 'numeric' })
  const weekdayLabels = [t('calendar.mon'), t('calendar.tue'), t('calendar.wed'), t('calendar.thu'), t('calendar.fri'), t('calendar.sat'), t('calendar.sun')]

  if (loading) return <div className="flex justify-center items-center h-full"><Spinner label={t('calendar.loading')} /></div>

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-100 capitalize">{monthLabel}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonthDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="btn-secondary btn-sm">‹</button>
          <button onClick={() => setMonthDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
            className="btn-secondary btn-sm">{t('calendar.today')}</button>
          <button onClick={() => setMonthDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            className="btn-secondary btn-sm">›</button>
          <button onClick={() => openAddModal(new Date())}
            className="btn-primary btn-sm ml-2">+ {t('calendar.addEvent')}</button>
        </div>
      </div>

      {/* Grid */}
      <div className="card p-2 md:p-4">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekdayLabels.map(w => (
            <div key={w} className="text-center text-[10px] md:text-xs font-semibold text-slate-500 uppercase py-1">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            const key = toKey(d)
            const inMonth = d.getMonth() === monthDate.getMonth()
            const isToday = key === todayKey
            const dayReminders = remindersByDay[key] || []
            const visible = dayReminders.slice(0, 3)
            const extra = dayReminders.length - visible.length
            return (
              <div
                key={i}
                onClick={() => openAddModal(d)}
                className={`min-h-[70px] md:min-h-[92px] rounded-lg p-1 md:p-1.5 border cursor-pointer transition-colors
                  ${inMonth ? 'bg-slate-800/40 border-slate-700/60 hover:border-primary-600/60' : 'bg-slate-900/20 border-slate-800/40 opacity-40'}
                  ${isToday ? 'ring-1 ring-primary-500' : ''}`}
              >
                <p className={`text-[10px] md:text-xs mb-1 ${isToday ? 'text-primary-400 font-bold' : 'text-slate-400'}`}>{d.getDate()}</p>
                <div className="space-y-0.5">
                  {visible.map(r => (
                    <div
                      key={r.id}
                      onClick={(e) => { e.stopPropagation(); openEditModal(r) }}
                      title={r.title}
                      className="text-[9px] md:text-[11px] px-1 py-0.5 rounded truncate text-white font-medium"
                      style={{ backgroundColor: eventColor(r) }}
                    >
                      {r.title}
                    </div>
                  ))}
                  {extra > 0 && (
                    <p className="text-[9px] md:text-[10px] text-slate-500 px-1">+{extra} {t('calendar.more')}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal añadir/editar evento */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? t('calendar.editEvent') : t('calendar.addEvent')} size="sm">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('calendar.eventTitle')}</label>
            <input required value={formTitle} onChange={e => setFormTitle(e.target.value)}
              className="input w-full" placeholder={t('home.examName')} autoFocus />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('calendar.eventDate')}</label>
            <input required type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
              className="input w-full" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">{t('calendar.subject')}</label>
            <select value={formSubjectId} onChange={e => handleSubjectChange(e.target.value)} className="input w-full">
              <option value=''>{t('home.noSubject')}</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input id="customColorCheck" type="checkbox" checked={customColor}
              onChange={e => {
                setCustomColor(e.target.checked)
                if (!e.target.checked) {
                  const subj = subjects.find(s => String(s.id) === String(formSubjectId))
                  setFormColor(subj?.color || DEFAULT_COLOR)
                }
              }}
              className="w-4 h-4" />
            <label htmlFor="customColorCheck" className="text-sm text-slate-300">{t('calendar.customColor')}</label>
            {customColor && (
              <input type="color" value={formColor} onChange={e => setFormColor(e.target.value)}
                className="w-9 h-9 rounded cursor-pointer bg-transparent border-0 ml-auto" title="Color" />
            )}
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? '⏳' : t('calendar.save')}
            </button>
            {editingId && (
              <button type="button" disabled={saving} onClick={handleDelete} className="btn-secondary text-red-400">
                {t('calendar.delete')}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  )
}
