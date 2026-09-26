import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  IconFileText, IconFolder, IconBrain, IconBook, IconCalculator,
  IconLink, IconCalendar, IconCards, IconPencil, IconClipboardCheck, IconNumbers,
  IconTarget, IconClock, IconChevronUp, IconChevronDown, IconLoader2, IconSparkles,
  IconNotes, IconListNumbers, IconBraces,
} from '@tabler/icons-react'
import { useAppStore } from '../../store/appStore'
import IconBadge from '../UI/IconBadge'
import Modal from '../UI/Modal'

// Tres botones grandes (Resumen / Tarjetas / Examen); cada uno abre sus
// opciones. El plan de estudio vive en su propia sección (/plan).
const MAIN = [
  { id: 'summary', Icon: IconFileText,       color: 'purple' },
  { id: 'cards',   Icon: IconCards,          color: 'green' },
  { id: 'exam',    Icon: IconClipboardCheck, color: 'amber' },
]

const CARD_ITEMS = [
  { id: 'flashcards', Icon: IconCards },
]

const EXAM_ITEMS = [
  { id: 'test',        Icon: IconClipboardCheck },
  { id: 'development', Icon: IconFileText },
  { id: 'problems',    Icon: IconNumbers },
  { id: 'adaptive',    Icon: IconTarget },
  { id: 'cloze',       Icon: IconPencil },
  { id: 'timed',       Icon: IconClock },
]

// Partes que se pueden añadir al resumen (el servidor las genera a la vez y
// cuenta una sola generación -- ver SUMMARY_EXTRAS en web_main.py).
const EXTRAS = [
  { id: 'schema',      Icon: IconFolder },
  { id: 'glossary',    Icon: IconBook },
  { id: 'formulas',    Icon: IconCalculator },
  { id: 'timeline',    Icon: IconCalendar },
  { id: 'connections', Icon: IconLink },
]
const SCHEMA_TYPES = [
  { id: 'schema',        Icon: IconListNumbers, key: 'numbered' },
  { id: 'schema_braces', Icon: IconBraces,      key: 'braces' },
  { id: 'mindmap',       Icon: IconBrain,       key: 'mindmap' },
]

const PREFS_KEY = 'summaryPrefs'
function loadPrefs() {
  try { return { extended: false, extras: [], schemaType: 'schema', ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') } }
  catch { return { extended: false, extras: [], schemaType: 'schema' } }
}

function OptionButton({ item, color, onClick, t }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left bg-slate-700/50 hover:bg-slate-700 border border-transparent hover:border-primary-500 transition-all"
    >
      <IconBadge icon={item.Icon} color={color} size="sm" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-100 leading-tight">{t(`actionPanel.items.${item.id}`)}</p>
        <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{t(`actionPanel.items.${item.id}Desc`)}</p>
      </div>
    </button>
  )
}

export default function ActionPanel({ doc, onGenerate, generating, activeAction, initialModal = null }) {
  const { t } = useTranslation()
  const responseLang = useAppStore(s => s.responseLang)
  const [difficulty, setDifficulty] = useState('normal')
  const [numQuestions, setNumQuestions] = useState(10)
  const [pages, setPages] = useState('')  // opcional: "1-3,8,15-20" -- vacío = documento completo
  const [showSettings, setShowSettings] = useState(false)
  // initialModal: se llega desde la sección Estudiar con la opción ya elegida
  const [modal, setModal] = useState(initialModal)  // 'summary' | 'cards' | 'exam' | 'problems' | 'timed'
  const [prefs, setPrefs] = useState(loadPrefs)
  const [timedTypes, setTimedTypes] = useState({ test: true, true_false: true, development: true, problem: true })
  const [timedMinutes, setTimedMinutes] = useState(numQuestions * 2)

  useEffect(() => {
    if (modal === 'timed') setTimedMinutes(Math.max(10, numQuestions * 2))
  }, [modal])

  function baseParams() {
    return { difficulty, num_questions: numQuestions, response_lang: responseLang, pages }
  }

  function run(actionId, extra = {}) {
    if (generating) return
    setModal(null)
    onGenerate(actionId, { ...baseParams(), ...extra })
  }

  function updatePrefs(next) {
    setPrefs(next)
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)) } catch { /* no crítico */ }
  }

  function toggleExtra(id) {
    const has = prefs.extras.includes(id)
    updatePrefs({ ...prefs, extras: has ? prefs.extras.filter(e => e !== id) : [...prefs.extras, id] })
  }

  function confirmSummary() {
    const extras = prefs.extras.map(e => (e === 'schema' ? prefs.schemaType : e))
    run(prefs.extended ? 'extended_summary' : 'summary', { extras })
  }

  function chooseExam(id) {
    if (id === 'problems' || id === 'timed') { setModal(id); return }
    run(id)
  }

  function toggleTimedType(type) {
    setTimedTypes(prev => {
      const next = { ...prev, [type]: !prev[type] }
      if (!next.test && !next.true_false && !next.development && !next.problem) return prev  // al menos uno marcado
      return next
    })
  }

  function confirmTimed() {
    const question_types = Object.entries(timedTypes).filter(([, v]) => v).map(([k]) => k)
    const parsed = parseInt(timedMinutes, 10)
    const time_limit_minutes = Number.isFinite(parsed) ? Math.min(240, Math.max(5, parsed)) : numQuestions * 2
    run('timed', { question_types, time_limit_minutes })
  }

  const DIFFICULTY_OPTS = [
    { value: 'simple',   label: t('actionPanel.easy'),     desc: t('actionPanel.easyDesc') },
    { value: 'normal',   label: t('actionPanel.normal'),   desc: t('actionPanel.normalDesc') },
    { value: 'advanced', label: t('actionPanel.advanced'), desc: t('actionPanel.advancedDesc') },
  ]

  const numQuestionsField = (
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
  )

  const busyGroup = activeAction && generating
    ? (['summary', 'extended_summary'].includes(activeAction) ? 'summary'
      : CARD_ITEMS.some(i => i.id === activeAction) ? 'cards' : 'exam')
    : null

  return (
    <div className="p-3 space-y-3">
      <p className="section-title">{t('actionPanel.generate')}</p>

      {MAIN.map(m => (
        <button
          key={m.id}
          onClick={() => !generating && setModal(m.id)}
          disabled={generating}
          className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left transition-all
            ${busyGroup === m.id ? 'bg-primary-700 border border-primary-500 text-white' : 'bg-slate-700/50 hover:bg-slate-700 border border-transparent hover:border-primary-500 text-slate-100'}
            ${generating && busyGroup !== m.id ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <IconBadge icon={m.Icon} color={m.color} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold leading-tight">{t(`actionPanel.main.${m.id}`)}</p>
            <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{t(`actionPanel.main.${m.id}Desc`)}</p>
          </div>
          {busyGroup === m.id && <IconLoader2 size={18} className="text-primary-300 animate-spin shrink-0" />}
        </button>
      ))}

      {/* Ajustes: nivel y páginas, plegados para no distraer */}
      <div className="pt-1">
        <button
          onClick={() => setShowSettings(v => !v)}
          className="w-full flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
        >
          <span>{t('actionPanel.settings')}</span>
          {showSettings ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        </button>
        {showSettings && (
          <div className="space-y-3 mt-2">
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
          </div>
        )}
      </div>

      {/* Modal: resumen con partes opcionales */}
      <Modal open={modal === 'summary'} onClose={() => setModal(null)} title={t('actionPanel.summaryModal.title')} size="sm">
        <div className="space-y-4">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">{t('actionPanel.summaryModal.length')}</p>
            <div className="flex gap-1">
              {[false, true].map(ext => (
                <button
                  key={String(ext)}
                  onClick={() => updatePrefs({ ...prefs, extended: ext })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                    ${prefs.extended === ext ? 'bg-primary-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                >
                  {t(ext ? 'actionPanel.summaryModal.long' : 'actionPanel.summaryModal.short')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">{t('actionPanel.summaryModal.add')}</p>
            <div className="space-y-1.5">
              {EXTRAS.map(x => (
                <div key={x.id}>
                  <label className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 cursor-pointer">
                    <input type="checkbox" checked={prefs.extras.includes(x.id)} onChange={() => toggleExtra(x.id)} className="accent-primary-500" />
                    <x.Icon size={16} className="text-slate-400 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm text-slate-200 leading-tight">{t(`actionPanel.items.${x.id}`)}</span>
                      <span className="block text-[11px] text-slate-500 leading-tight">{t(`actionPanel.items.${x.id}Desc`)}</span>
                    </span>
                  </label>
                  {x.id === 'schema' && prefs.extras.includes('schema') && (
                    <div className="flex gap-1 mt-1 ml-7">
                      {SCHEMA_TYPES.map(s => (
                        <button
                          key={s.id}
                          onClick={() => updatePrefs({ ...prefs, schemaType: s.id })}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors
                            ${prefs.schemaType === s.id ? 'bg-primary-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                        >
                          {t(`actionPanel.schemaModal.${s.key}Title`)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <button onClick={confirmSummary} className="btn-primary w-full">
            {t('actionPanel.summaryModal.confirm')}
          </button>
        </div>
      </Modal>

      {/* Modal: tarjetas */}
      <Modal open={modal === 'cards'} onClose={() => setModal(null)} title={t('actionPanel.main.cards')} size="sm">
        <div className="space-y-3">
          {numQuestionsField}
          {CARD_ITEMS.map(item => (
            <OptionButton key={item.id} item={item} color="green" onClick={() => run(item.id)} t={t} />
          ))}
        </div>
      </Modal>

      {/* Modal: examen */}
      <Modal open={modal === 'exam'} onClose={() => setModal(null)} title={t('actionPanel.main.exam')} size="sm">
        <div className="space-y-3">
          {numQuestionsField}
          {EXAM_ITEMS.map(item => (
            <OptionButton key={item.id} item={item} color="amber" onClick={() => chooseExam(item.id)} t={t} />
          ))}
        </div>
      </Modal>

      {/* Modal: elegir tipo de problemas */}
      <Modal open={modal === 'problems'} onClose={() => setModal(null)} title={t('actionPanel.problemsModal.title')} size="sm">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => run('problems_new')}
            className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-slate-700/50 hover:bg-slate-700 border border-transparent hover:border-primary-500 transition-all"
          >
            <IconBadge icon={IconSparkles} color="amber" size="lg" />
            <span className="text-sm font-semibold text-slate-100">{t('actionPanel.problemsModal.newTitle')}</span>
            <span className="text-[11px] text-slate-400 text-center">{t('actionPanel.problemsModal.newDesc')}</span>
          </button>
          <button
            onClick={() => run('problems')}
            className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-slate-700/50 hover:bg-slate-700 border border-transparent hover:border-primary-500 transition-all"
          >
            <IconBadge icon={IconNotes} color="amber" size="lg" />
            <span className="text-sm font-semibold text-slate-100">{t('actionPanel.problemsModal.notesTitle')}</span>
            <span className="text-[11px] text-slate-400 text-center">{t('actionPanel.problemsModal.notesDesc')}</span>
          </button>
        </div>
      </Modal>

      {/* Modal: configurar simulacro */}
      <Modal open={modal === 'timed'} onClose={() => setModal(null)} title={t('actionPanel.timedModal.title')} size="sm">
        <div className="space-y-4">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">{t('actionPanel.timedModal.types')}</p>
            <div className="space-y-1.5">
              {['test', 'true_false', 'development', 'problem'].map(type => (
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
              onChange={e => setTimedMinutes(e.target.value.replace(/[^0-9]/g, ''))}
              onBlur={() => {
                const parsed = parseInt(timedMinutes, 10)
                setTimedMinutes(Number.isFinite(parsed) ? Math.min(240, Math.max(5, parsed)) : numQuestions * 2)
              }}
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
