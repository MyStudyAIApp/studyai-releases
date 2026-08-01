import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  IconFileText, IconSearch, IconFolder, IconBrain, IconBook, IconCalculator,
  IconLink, IconCalendar, IconCards, IconPencil, IconClipboardCheck, IconNumbers,
  IconTarget, IconClock, IconChevronUp, IconChevronDown, IconLoader2, IconSparkles,
  IconNotes, IconListNumbers, IconBraces,
} from '@tabler/icons-react'
import WeeklyHoursWidget, { loadWeeklyHours, saveWeeklyHours } from '../Study/WeeklyHoursWidget'
import { useAppStore } from '../../store/appStore'
import IconBadge from '../UI/IconBadge'
import Modal from '../UI/Modal'

// Un color por grupo, igual que en la maqueta (Comprensión=morado, Memorización=verde,
// Evaluación=ámbar, Estudio=rosa) — colores fijos de Tailwind, iguales en los 4 temas.
const GROUP_COLORS = {
  'Comprensión':  'purple',
  'Memorización': 'green',
  'Evaluación':   'amber',
  'Estudio':      'pink',
}

const ACTION_DEFS = [
  {
    groupKey: 'Comprensión',
    items: [
      { id: 'summary',           Icon: IconFileText },
      { id: 'extended_summary',  Icon: IconSearch },
      { id: 'schema',            Icon: IconFolder },
      { id: 'glossary',     Icon: IconBook },
      { id: 'formulas',     Icon: IconCalculator },
      { id: 'connections',  Icon: IconLink },
      { id: 'timeline',     Icon: IconCalendar },
    ],
  },
  {
    groupKey: 'Memorización',
    items: [
      { id: 'flashcards', Icon: IconCards },
      { id: 'cloze',      Icon: IconPencil },
    ],
  },
  {
    groupKey: 'Evaluación',
    items: [
      { id: 'test',        Icon: IconClipboardCheck },
      { id: 'development', Icon: IconFileText },
      { id: 'problems',    Icon: IconNumbers },
      { id: 'adaptive',    Icon: IconTarget },
      { id: 'timed',       Icon: IconClock },
    ],
  },
  {
    groupKey: 'Estudio',
    items: [
      { id: 'studyplan', Icon: IconCalendar },
    ],
  },
]

export default function ActionPanel({ doc, onGenerate, generating, activeAction }) {
  const { t } = useTranslation()
  const responseLang = useAppStore(s => s.responseLang)
  const [difficulty, setDifficulty] = useState('normal')
  const [numQuestions, setNumQuestions] = useState(10)
  const [examDate, setExamDate] = useState('')
  const [pages, setPages] = useState('')  // opcional: "1-3,8,15-20" -- vacío = documento completo
  const [weeklyHours, setWeeklyHours] = useState(() => loadWeeklyHours())
  const [expandedGroup, setExpandedGroup] = useState(null)  // todos los grupos retraídos por defecto
  const [showProblemsModal, setShowProblemsModal] = useState(false)
  const [showSchemaModal, setShowSchemaModal] = useState(false)
  const [showTimedModal, setShowTimedModal] = useState(false)
  const [timedTypes, setTimedTypes] = useState({ test: true, development: true, problem: true })
  const [timedMinutes, setTimedMinutes] = useState(numQuestions * 2)

  useEffect(() => {
    if (showTimedModal) setTimedMinutes(Math.max(10, numQuestions * 2))
  }, [showTimedModal])

  function handleWeeklyHoursChange(h) {
    setWeeklyHours(h)
    saveWeeklyHours(h)
  }

  function baseParams() {
    return { difficulty, num_questions: numQuestions, exam_date: examDate, weekly_hours: weeklyHours, response_lang: responseLang, pages }
  }

  function handleAction(actionId) {
    if (generating) return
    if (actionId === 'problems') { setShowProblemsModal(true); return }
    if (actionId === 'schema') { setShowSchemaModal(true); return }
    if (actionId === 'timed') { setShowTimedModal(true); return }
    onGenerate(actionId, baseParams())
  }

  function chooseSchema(actionId) {
    setShowSchemaModal(false)
    onGenerate(actionId, baseParams())
  }

  function toggleTimedType(type) {
    setTimedTypes(t => {
      const next = { ...t, [type]: !t[type] }
      if (!next.test && !next.development && !next.problem) return t  // al menos uno marcado
      return next
    })
  }

  function confirmTimed() {
    const question_types = Object.entries(timedTypes).filter(([, v]) => v).map(([k]) => k)
    onGenerate('timed', { ...baseParams(), question_types, time_limit_minutes: timedMinutes })
    setShowTimedModal(false)
  }

  function chooseProblems(actionId) {
    setShowProblemsModal(false)
    onGenerate(actionId, baseParams())
  }

  const DIFFICULTY_OPTS = [
    { value: 'simple',   label: t('actionPanel.easy'),     desc: t('actionPanel.easyDesc') },
    { value: 'normal',   label: t('actionPanel.normal'),   desc: t('actionPanel.normalDesc') },
    { value: 'advanced', label: t('actionPanel.advanced'), desc: t('actionPanel.advancedDesc') },
  ]

  return (
    <div className="p-3 space-y-4">
      <p className="section-title">{t('actionPanel.generate')}</p>

      {/* Difficulty */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">{t('actionPanel.difficulty')}</p>
        <div className="flex gap-1">
          {DIFFICULTY_OPTS.map(d => (
            <button
              key={d.value}
              onClick={() => setDifficulty(d.value)}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors
                ${difficulty === d.value ? 'bg-primary-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              title={d.desc}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Nº questions (only for exam actions) */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">{t('actionPanel.numQuestions')}</p>
        <input
          type="number"
          min={5} max={50}
          value={numQuestions}
          onChange={e => setNumQuestions(Number(e.target.value))}
          className="input text-sm"
        />
      </div>

      {/* Rango de páginas (opcional) -- solo tiene sentido si el documento tiene varias */}
      {doc?.pages > 1 && (
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">{t('actionPanel.pagesLabel')}</p>
          <input
            type="text"
            value={pages}
            onChange={e => setPages(e.target.value)}
            placeholder="1-3, 8, 15-20"
            className="input text-sm"
          />
          <p className="text-[10px] text-slate-500 mt-1 leading-snug">{t('actionPanel.pagesHelp', { total: doc.pages })}</p>
        </div>
      )}

      {/* Actions by group */}
      {ACTION_DEFS.map(group => (
        <div key={group.groupKey}>
          <button
            onClick={() => setExpandedGroup(g => g === group.groupKey ? null : group.groupKey)}
            className="w-full flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 hover:text-slate-300 transition-colors"
          >
            <span>{t(`actionPanel.groups.${group.groupKey}`)}</span>
            {expandedGroup === group.groupKey ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          </button>
          {expandedGroup === group.groupKey && (
            <div className="space-y-1">
              {group.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleAction(item.id)}
                  disabled={generating}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all duration-150
                    ${activeAction === item.id && generating
                      ? 'bg-primary-700 border border-primary-500 text-white'
                      : activeAction === item.id
                      ? 'bg-primary-900/40 border border-primary-700 text-primary-300'
                      : 'bg-slate-700/50 hover:bg-slate-700 text-slate-200 border border-transparent'}
                    ${generating && activeAction !== item.id ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <IconBadge icon={item.Icon} color={GROUP_COLORS[group.groupKey]} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-tight">{t(`actionPanel.items.${item.id}`)}</p>
                    <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">{t(`actionPanel.items.${item.id}Desc`)}</p>
                  </div>
                  {activeAction === item.id && generating && (
                    <IconLoader2 size={16} className="ml-auto text-primary-400 animate-spin shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Exam date for study plan */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">{t('actionPanel.examDate')}</p>
        <input
          type="date"
          value={examDate}
          onChange={e => setExamDate(e.target.value)}
          className="input text-sm"
        />
      </div>

      {/* Weekly study hours */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Horas disponibles / semana</p>
        <WeeklyHoursWidget compact hours={weeklyHours} onChange={handleWeeklyHoursChange} />
      </div>

      {/* Modal: elegir tipo de problemas */}
      <Modal open={showProblemsModal} onClose={() => setShowProblemsModal(false)} title={t('actionPanel.problemsModal.title')} size="sm">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => chooseProblems('problems_new')}
            className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-slate-700/50 hover:bg-slate-700 border border-transparent hover:border-primary-500 transition-all"
          >
            <IconBadge icon={IconSparkles} color="amber" size="lg" />
            <span className="text-sm font-semibold text-slate-100">{t('actionPanel.problemsModal.newTitle')}</span>
            <span className="text-[11px] text-slate-400 text-center">{t('actionPanel.problemsModal.newDesc')}</span>
          </button>
          <button
            onClick={() => chooseProblems('problems')}
            className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-slate-700/50 hover:bg-slate-700 border border-transparent hover:border-primary-500 transition-all"
          >
            <IconBadge icon={IconNotes} color="amber" size="lg" />
            <span className="text-sm font-semibold text-slate-100">{t('actionPanel.problemsModal.notesTitle')}</span>
            <span className="text-[11px] text-slate-400 text-center">{t('actionPanel.problemsModal.notesDesc')}</span>
          </button>
        </div>
      </Modal>

      {/* Modal: elegir tipo de esquema */}
      <Modal open={showSchemaModal} onClose={() => setShowSchemaModal(false)} title={t('actionPanel.schemaModal.title')} size="sm">
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => chooseSchema('schema')}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-slate-700/50 hover:bg-slate-700 border border-transparent hover:border-primary-500 transition-all"
          >
            <IconBadge icon={IconListNumbers} color="purple" size="lg" />
            <span className="text-sm font-semibold text-slate-100 text-center">{t('actionPanel.schemaModal.numberedTitle')}</span>
            <span className="text-[11px] text-slate-400 text-center">{t('actionPanel.schemaModal.numberedDesc')}</span>
          </button>
          <button
            onClick={() => chooseSchema('schema_braces')}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-slate-700/50 hover:bg-slate-700 border border-transparent hover:border-primary-500 transition-all"
          >
            <IconBadge icon={IconBraces} color="purple" size="lg" />
            <span className="text-sm font-semibold text-slate-100 text-center">{t('actionPanel.schemaModal.bracesTitle')}</span>
            <span className="text-[11px] text-slate-400 text-center">{t('actionPanel.schemaModal.bracesDesc')}</span>
          </button>
          <button
            onClick={() => chooseSchema('mindmap')}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-slate-700/50 hover:bg-slate-700 border border-transparent hover:border-primary-500 transition-all"
          >
            <IconBadge icon={IconBrain} color="purple" size="lg" />
            <span className="text-sm font-semibold text-slate-100 text-center">{t('actionPanel.schemaModal.mindmapTitle')}</span>
            <span className="text-[11px] text-slate-400 text-center">{t('actionPanel.schemaModal.mindmapDesc')}</span>
          </button>
        </div>
      </Modal>

      {/* Modal: configurar simulacro */}
      <Modal open={showTimedModal} onClose={() => setShowTimedModal(false)} title={t('actionPanel.timedModal.title')} size="sm">
        <div className="space-y-4">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">{t('actionPanel.timedModal.types')}</p>
            <div className="space-y-1.5">
              {['test', 'development', 'problem'].map(type => (
                <label key={type} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={timedTypes[type]}
                    onChange={() => toggleTimedType(type)}
                    className="accent-primary-500"
                  />
                  <span className="text-sm text-slate-200">{t(`actionPanel.timedModal.type_${type}`)}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">{t('actionPanel.timedModal.minutes')}</p>
            <input
              type="number"
              min={5} max={240}
              value={timedMinutes}
              onChange={e => setTimedMinutes(Number(e.target.value))}
              className="input text-sm"
            />
          </div>
          <button onClick={confirmTimed} className="btn-primary w-full">
            {t('actionPanel.timedModal.confirm')}
          </button>
        </div>
      </Modal>
    </div>
  )
}
