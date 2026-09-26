import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconCalendar, IconPlus, IconLoader2, IconTrash } from '@tabler/icons-react'
import { useAppStore, api } from '../store/appStore'
import WeeklyHoursWidget, { loadWeeklyHours, saveWeeklyHours } from '../components/Study/WeeklyHoursWidget'

// Sección propia del plan de estudio: antes estaba escondida en el panel de
// cada documento y en la selección múltiple de la Biblioteca.
export default function StudyPlanPage() {
  const { t, i18n } = useTranslation()
  const { backendReady, addToast } = useAppStore()
  const navigate = useNavigate()
  const [plans, setPlans] = useState(null)
  const [docs, setDocs] = useState([])
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [examDate, setExamDate] = useState('')
  const [title, setTitle] = useState('')
  const [weeklyHours, setWeeklyHours] = useState(() => loadWeeklyHours())
  const [generating, setGenerating] = useState(false)
  const [subjects, setSubjects] = useState([])
  const [subjectId, setSubjectId] = useState('')
  const [customColor, setCustomColor] = useState(false)
  const [color, setColor] = useState('#8b5cf6')

  useEffect(() => {
    if (!backendReady) return
    api('GET', '/studyplans').then(r => {
      setPlans(r.items || [])
      if (!r.items?.length) setCreating(true)
    }).catch(() => setPlans([]))
    // Los propios planes también son "documentos" (file_path __combined__): no se ofrecen
    api('GET', '/subjects').then(r => setSubjects(Array.isArray(r) ? r : (r.items || []))).catch(() => {})
    api('GET', '/documents').then(r => setDocs((r.items || []).filter(d => d.file_path !== '__combined__')))
  }, [backendReady])

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // El plan es un documento propio (file_path __combined__): borrarlo es el
  // mismo borrado suave de la Biblioteca. Los apuntes de origen no se tocan.
  async function removePlan(p) {
    if (!window.confirm(t('studyPlanPage.confirmDelete', { title: p.title }))) return
    try {
      await api('DELETE', `/documents/${p.doc_id}`)
      setPlans(prev => prev.filter(x => x.doc_id !== p.doc_id))
    } catch (e) {
      addToast(`Error: ${e.message}`, 'error')
    }
  }

  async function generate() {
    if (!selected.size || generating) return
    setGenerating(true)
    try {
      const res = await api('POST', '/documents/multi-plan', {
        doc_ids: [...selected],
        exam_date: examDate,
        title: title.trim() || undefined,
        weekly_hours: weeklyHours,
      })
      // Igual que en la Biblioteca: con fecha, el plan crea también su aviso de examen
      if (examDate) {
        try {
          await api('POST', '/exams/reminders', {
            title: res.title,
            exam_date: examDate,
            subject_id: subjectId ? (isNaN(Number(subjectId)) ? subjectId : Number(subjectId)) : null,
            color: customColor ? color : null,
          })
        } catch { /* no bloquear el plan si falla el aviso */ }
      }
      navigate(`/document/${res.doc_id}`, { state: { autoResult: res.result, autoAction: 'studyplan' } })
    } catch (e) {
      if (!e.quotaExceeded) addToast(`Error: ${e.message}`, 'error')
    } finally {
      setGenerating(false)
    }
  }

  // Documentos agrupados por asignatura
  const groups = docs.reduce((acc, d) => {
    const k = d.subject_name || t('exam.noSubject')
    ;(acc[k] ||= []).push(d)
    return acc
  }, {})

  const fmt = (d) => new Date(d).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-100 flex-1">{t('studyPlanPage.title')}</h1>
        {!creating && (
          <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-1.5">
            <IconPlus size={16} /> {t('studyPlanPage.new')}
          </button>
        )}
      </div>

      {plans === null && <IconLoader2 className="animate-spin text-slate-500" />}

      {plans?.length > 0 && (
        <div className="space-y-2">
          <p className="section-title">{t('studyPlanPage.yourPlans')}</p>
          {plans.map(p => (
            <button
              key={p.doc_id + p.created_at}
              onClick={() => navigate(`/document/${p.doc_id}`)}
              className="card-hover w-full flex items-center gap-4 text-left"
            >
              <IconCalendar size={22} className="text-pink-400 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-slate-100 truncate">{p.title}</p>
                <p className="text-xs text-slate-400">
                  {p.exam_date ? t('studyPlanPage.examOn', { date: fmt(p.exam_date) }) : t('studyPlanPage.noDate')}
                  {' · '}{t('studyPlanPage.days', { count: p.days })}
                </p>
              </div>
              <span
                role="button"
                title={t('studyPlanPage.delete')}
                onClick={e => { e.stopPropagation(); removePlan(p) }}
                className="ml-auto p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700"
              >
                <IconTrash size={16} />
              </span>
            </button>
          ))}
        </div>
      )}

      {creating && (
        <div className="card space-y-5">
          <div>
            <p className="font-semibold text-slate-100">{t('studyPlanPage.new')}</p>
            <p className="text-sm text-slate-400">{t('studyPlanPage.pickDocs')}</p>
          </div>

          {docs.length === 0 ? (
            <p className="text-sm text-slate-500">{t('studyPlanPage.noDocs')}</p>
          ) : (
            <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
              {Object.entries(groups).map(([subject, list]) => (
                <div key={subject}>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">{subject}</p>
                  <div className="space-y-1">
                    {list.map(d => (
                      <label key={d.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 cursor-pointer">
                        <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} className="accent-primary-500" />
                        <span className="text-sm text-slate-200 truncate">{d.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1.5">{t('library.jointPlan.examDate')}</label>
              <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} className="input text-sm" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1.5">
                {t('library.jointPlan.title')} <span className="text-slate-600">({t('common.optional')})</span>
              </label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="input text-sm" />
            </div>
          </div>

          {/* Aviso de examen en el calendario: asignatura (su color) o color propio, como en la Biblioteca */}
          {examDate && (
            <div className="bg-slate-900/60 rounded-lg p-3 space-y-2">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">📅 {t('library.jointPlan.reminderInfo')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <select value={subjectId} onChange={e => {
                    setSubjectId(e.target.value)
                    if (!customColor) setColor(subjects.find(s => String(s.id) === e.target.value)?.color || '#8b5cf6')
                  }}
                  className="input text-sm py-1.5 flex-1 min-w-32">
                  <option value=''>{t('common.noSubject')}</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-slate-400">
                  <input type="checkbox" checked={customColor}
                    onChange={e => {
                      setCustomColor(e.target.checked)
                      if (!e.target.checked) setColor(subjects.find(s => String(s.id) === subjectId)?.color || '#8b5cf6')
                    }}
                    className="w-3.5 h-3.5" />
                  {t('mobile.exams.customColor')}
                </label>
                {customColor && (
                  <input type="color" value={color} onChange={e => setColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" title="Color" />
                )}
              </div>
            </div>
          )}

          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">{t('library.jointPlan.hoursWeek')}</p>
            <WeeklyHoursWidget compact hours={weeklyHours} onChange={h => { setWeeklyHours(h); saveWeeklyHours(h) }} />
          </div>

          <button onClick={generate} disabled={!selected.size || generating} className="btn-primary w-full disabled:opacity-50">
            {generating ? `⏳ ${t('library.generating')}` : `📅 ${t('studyPlanPage.generate', { count: selected.size })}`}
          </button>
        </div>
      )}
    </div>
  )
}
