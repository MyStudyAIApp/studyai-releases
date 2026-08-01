import { useState } from 'react'
import { useAppStore, api, apiStream } from '../../store/appStore'

// Examen adaptativo real: tras corregir, si hay falladas, se generan preguntas
// NUEVAS centradas en esos mismos puntos débiles (no se repite la misma
// pregunta) y se repite hasta acertarlas todas. Solo tipo test (A/B/C/D).
export default function AdaptiveExamView({ result, doc }) {
  const { addToast } = useAppStore()
  const [round, setRound] = useState(1)
  const [questions, setQuestions] = useState(result.questions || [])
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [totals, setTotals] = useState({ correct: 0, total: 0 })
  const [finished, setFinished] = useState(false)

  function handleAnswer(qIdx, value) {
    if (submitted) return
    setAnswers(a => ({ ...a, [qIdx]: value }))
  }

  function handleSubmit() {
    setSubmitted(true)
    const correctCount = questions.filter((q, i) => answers[i] === (q.correct_index ?? q.correct)).length
    setTotals(t => ({ correct: t.correct + correctCount, total: t.total + questions.length }))
  }

  const wrongQuestions = questions.filter((q, i) => answers[i] !== (q.correct_index ?? q.correct))

  async function saveFinalResult() {
    try {
      await api('POST', '/exams/results', {
        document_id: doc?.id,
        type: 'adaptive',
        total: totals.total,
        correct: totals.correct,
      })
    } catch {}
  }

  async function repeatWrong() {
    if (wrongQuestions.length === 0) return
    setRegenerating(true)
    try {
      const weak_topics = wrongQuestions.map(q => q.question).slice(0, 10)
      let finalResult = null
      await apiStream(
        '/generate/adaptive',
        { document_id: doc?.id, weak_topics, num_questions: wrongQuestions.length, difficulty: 'normal' },
        (chunk) => { if (chunk.result) finalResult = chunk.result },
      )
      if (finalResult?.questions?.length) {
        setQuestions(finalResult.questions)
        setAnswers({})
        setSubmitted(false)
        setRound(r => r + 1)
      } else {
        addToast('No se pudieron generar más preguntas', 'error')
      }
    } catch (e) {
      addToast(`Error: ${e.message}`, 'error')
    } finally {
      setRegenerating(false)
    }
  }

  async function finishExam() {
    setFinished(true)
    await saveFinalResult()
  }

  if (finished) {
    const pct = totals.total > 0 ? Math.round((totals.correct / totals.total) * 100) : 0
    return (
      <div className="max-w-xl mx-auto text-center py-16 space-y-6">
        <div className="text-6xl">🎯</div>
        <h2 className="text-2xl font-bold">¡Examen adaptativo completado!</h2>
        <div className="card text-left space-y-2">
          <p className="text-slate-300 text-sm">✅ {totals.correct} respuestas correctas de {totals.total} totales (en {round} {round === 1 ? 'ronda' : 'rondas'})</p>
          <p className="text-slate-400 text-xs">{pct}% de aciertos acumulado</p>
        </div>
        <p className="text-slate-400 text-sm">Has acertado todas las preguntas de la última ronda. 🎉</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur py-2 z-10">
        <div>
          <p className="font-semibold text-slate-100">Ronda {round} · {questions.length} preguntas</p>
          <p className="text-xs text-slate-400">{Object.keys(answers).length} respondidas</p>
        </div>
        {!submitted && (
          <button
            onClick={handleSubmit}
            disabled={Object.keys(answers).length === 0}
            className="btn-primary"
          >
            Corregir
          </button>
        )}
      </div>

      {questions.map((q, i) => {
        const correctIdx = q.correct_index ?? q.correct
        const userAns = answers[i]
        const isCorrect = submitted ? userAns === correctIdx : null
        return (
          <div key={i} className={`card ${submitted ? (isCorrect ? 'border border-emerald-700/50' : 'border border-red-700/50') : ''}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-primary-400 font-bold text-sm">{i + 1}.</span>
              <p className="text-sm font-medium text-slate-100">{q.question}</p>
            </div>
            <div className="space-y-2">
              {q.options.map((opt, oi) => (
                <button
                  key={oi}
                  onClick={() => handleAnswer(i, oi)}
                  disabled={submitted}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-all border
                    ${submitted
                      ? oi === correctIdx ? 'bg-emerald-900/40 border-emerald-600 text-emerald-300 font-medium'
                        : oi === userAns ? 'bg-red-900/40 border-red-600 text-red-300'
                        : 'border-slate-700 text-slate-500'
                      : userAns === oi
                        ? 'bg-primary-700/50 border-primary-500 text-primary-200 font-medium'
                        : 'bg-slate-700/30 border-slate-600 text-slate-300 hover:bg-slate-700'}`}
                >
                  <span className="font-semibold mr-2">{String.fromCharCode(65 + oi)})</span>{String(opt).replace(/^[A-Da-d][).]\s*/, '')}
                </button>
              ))}
            </div>
            {submitted && q.explanation && (
              <p className="text-xs text-slate-400 mt-2 italic">💡 {q.explanation}</p>
            )}
          </div>
        )
      })}

      {!submitted && (
        <button onClick={handleSubmit} className="btn-primary w-full py-3 mt-4">
          Corregir
        </button>
      )}

      {submitted && (
        wrongQuestions.length > 0 ? (
          <button onClick={repeatWrong} disabled={regenerating} className="btn-primary w-full py-3 mt-4">
            {regenerating ? '⏳ Generando preguntas nuevas...' : `🔁 Repetir ${wrongQuestions.length} falladas con preguntas nuevas`}
          </button>
        ) : (
          <button onClick={finishExam} className="btn-primary w-full py-3 mt-4">
            ✅ Terminar prueba
          </button>
        )
      )}
    </div>
  )
}
