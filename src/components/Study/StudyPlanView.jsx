import { useState } from 'react'
import { api, useAppStore } from '../../store/appStore'
import Modal from '../UI/Modal'
import TestExamView from '../Exam/TestExamView'

const DAY_ACTIONS = [
  { id: 'flashcards',   icon: '🃏', label: 'Flashcards'   },
  { id: 'test',         icon: '☑️',  label: 'Test'         },
  { id: 'cloze',        icon: '✏️',  label: 'Huecos'       },
  { id: 'development',  icon: '📄', label: 'Desarrollo'   },
  { id: 'summary',      icon: '📝', label: 'Resumen'      },
  { id: 'problems',     icon: '🔢', label: 'Problemas'    },
]

const PASS_THRESHOLD = 80

export default function StudyPlanView({ result, doc, onPrepDay }) {
  const { days = [], summary, exam_date, total_topics, day_state } = result
  const { addToast } = useAppStore()
  const [expandedDay, setExpandedDay] = useState(null)
  const [dayState, setDayState] = useState(day_state || {})   // { "dayIdx": {passed, best_score_pct, attempts} }
  const [quizFor, setQuizFor] = useState(null)      // { dayIdx, final } | null
  const [quizResult, setQuizResult] = useState(null)
  const [quizLoading, setQuizLoading] = useState(false)

  function dayPassed(dayIdx) {
    return !!dayState[dayIdx]?.passed
  }

  async function startQuiz(dayIdx, final) {
    setQuizFor({ dayIdx, final })
    setQuizLoading(true)
    setQuizResult(null)
    try {
      const res = await api('POST', `/documents/${doc.id}/studyplan-day-quiz`, { day_index: dayIdx, final })
      setQuizResult(res)
    } catch (e) {
      addToast(`No se pudo generar la prueba: ${e.message}`, 'error')
      setQuizFor(null)
    } finally {
      setQuizLoading(false)
    }
  }

  async function handleQuizFinished(pct) {
    if (!quizFor || !doc?.id) return
    const passed = pct >= PASS_THRESHOLD
    try {
      const res = await api('PATCH', `/documents/${doc.id}/studyplan-day`, {
        day_index: quizFor.dayIdx, score_pct: pct, passed,
      })
      setDayState(prev => ({ ...prev, [quizFor.dayIdx]: res.day_state }))
      addToast(passed ? `¡Día ${quizFor.dayIdx + 1} aprobado! (${pct}%)` : `${pct}% — necesitas ${PASS_THRESHOLD}% para aprobar`, passed ? 'success' : 'warning')
    } catch {
      addToast('No se pudo guardar el resultado de la prueba', 'error')
    }
  }

  function closeQuiz() {
    setQuizFor(null)
    setQuizResult(null)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-8">

      {/* Header */}
      <div className="card bg-primary-900/30 border-primary-700">
        <h2 className="text-lg font-bold text-slate-100 mb-1">Plan de estudio</h2>
        {exam_date && (
          <p className="text-sm text-primary-300">
            📅 Examen: {new Date(exam_date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        )}
        {summary && <p className="text-sm text-slate-300 mt-1">{summary}</p>}
        {total_topics && (
          <p className="text-xs text-slate-400 mt-1">{total_topics} temas · {days.length} días de estudio</p>
        )}
      </div>

      {/* Days */}
      <div className="space-y-3">
        {days.map((day, i) => {
          const isFinal   = i === days.length - 1
          const passed    = dayPassed(i)
          const attempted = !!dayState[i]
          const expanded  = expandedDay === i
          const isToday   = day.date === new Date().toISOString().slice(0, 10)
          const prevBlocked = i > 0 && !dayPassed(i - 1)

          return (
            <div
              key={i}
              className={`card transition-all ${
                passed      ? 'border-emerald-700/50 bg-emerald-900/10 opacity-75' :
                isToday     ? 'border-primary-500/70 bg-primary-900/20' :
                day.is_review ? 'border-yellow-700/50 bg-yellow-900/10' : ''
              }`}
            >
              {/* Day header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    passed      ? 'bg-emerald-600 text-white' :
                    isToday     ? 'bg-primary-500 text-white ring-2 ring-primary-400/50' :
                    day.is_review ? 'bg-yellow-700 text-yellow-100' :
                    'bg-primary-700 text-white'
                  }`}>
                    {passed ? '✓' : i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-sm text-slate-100 flex items-center gap-1.5">
                      {isFinal ? 'Examen final' : day.date
                        ? new Date(day.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
                        : `Día ${i + 1}`}
                      {isToday && !isFinal && <span className="text-[10px] bg-primary-500/30 text-primary-300 px-1.5 py-0.5 rounded-full font-medium">HOY</span>}
                    </p>
                    {day.is_review && <span className="text-[10px] text-yellow-400">🔄 Repaso general</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{day.study_hours}h</span>
                  {onPrepDay && (
                    <button
                      onClick={() => setExpandedDay(expanded ? null : i)}
                      className={`btn-sm px-2 py-1 rounded-lg text-xs font-medium border transition-all ${
                        expanded
                          ? 'bg-primary-600/30 border-primary-500 text-primary-300'
                          : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-primary-500 hover:text-primary-300'
                      }`}
                      title="Preparar este día"
                    >
                      {expanded ? '▲ Cerrar' : '⚡ Preparar'}
                    </button>
                  )}
                </div>
              </div>

              {/* Topics (solo lectura, ya no son casillas — el avance ahora lo da la prueba) */}
              {day.topics?.length > 0 && (
                <ul className="space-y-1 ml-9 list-disc list-inside">
                  {day.topics.map((t, j) => (
                    <li key={j} className="text-sm text-slate-300">{t}</li>
                  ))}
                </ul>
              )}

              {day.tip && (
                <p className="text-xs text-slate-500 mt-2 ml-9 italic">💡 {day.tip}</p>
              )}

              {/* Aviso blando si el día anterior no está aprobado — no bloquea */}
              {prevBlocked && !passed && (
                <p className="text-xs text-amber-400 mt-2 ml-9 flex items-center gap-1">
                  ⚠️ No has terminado la prueba del día anterior
                </p>
              )}

              {/* Prueba del día / examen final */}
              <div className="mt-3 ml-9">
                {passed ? (
                  <p className="text-xs text-emerald-400">
                    ✅ {isFinal ? 'Examen final aprobado' : 'Prueba aprobada'} — mejor nota: {dayState[i]?.best_score_pct}%
                  </p>
                ) : (
                  <button
                    onClick={() => startQuiz(i, isFinal)}
                    className="btn-secondary btn-sm"
                  >
                    {attempted
                      ? `🔁 Reintentar (última: ${dayState[i]?.best_score_pct}%)`
                      : isFinal ? '🎓 Empezar examen final' : '▶️ Empezar prueba del día'}
                  </button>
                )}
              </div>

              {/* Action panel — shown when ⚡ Preparar is clicked */}
              {expanded && onPrepDay && (
                <div className="mt-3 ml-9 pt-3 border-t border-slate-700/50">
                  <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wider">
                    Generar para los temas de hoy:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {DAY_ACTIONS.map(a => (
                      <button
                        key={a.id}
                        onClick={() => {
                          setExpandedDay(null)
                          onPrepDay(day, a.id)
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                                   bg-slate-700/60 border border-slate-600 text-slate-200
                                   hover:bg-primary-700/40 hover:border-primary-500 hover:text-primary-200
                                   transition-all"
                      >
                        <span>{a.icon}</span> {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal de la prueba diaria / examen final */}
      <Modal open={!!quizFor} onClose={closeQuiz} title={quizFor?.final ? 'Examen final' : `Prueba del día ${quizFor ? quizFor.dayIdx + 1 : ''}`} size="lg">
        {quizLoading && (
          <div className="text-center py-16 space-y-3">
            <div className="text-4xl animate-pulse">✨</div>
            <p className="text-slate-400 text-sm">Generando la prueba…</p>
          </div>
        )}
        {quizResult && (
          <TestExamView result={quizResult} doc={doc} onFinished={handleQuizFinished} />
        )}
      </Modal>
    </div>
  )
}
