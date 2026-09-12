import { useState } from 'react'
import { useAppStore, api } from '../../store/appStore'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { ensureMathDelimiters } from '../../utils/mathText'

// Mismo trio que en ProblemsView: sin esto, un "10^n" o una raiz se veian en
// crudo justo en la pantalla donde el alumno compara su respuesta con la buena.
const MD_OPTS = { remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex] }

export default function DevelopmentExamView({ result, doc }) {
  const { questions = [] } = result
  const { addToast } = useAppStore()
  const [answers, setAnswers] = useState({})
  const [evaluations, setEvaluations] = useState({})
  const [evaluating, setEvaluating] = useState({})
  const [showModel, setShowModel] = useState({})

  async function evaluateAnswer(qIdx) {
    const userAnswer = answers[qIdx]
    if (!userAnswer?.trim()) { addToast('Escribe tu respuesta primero', 'warning'); return }
    setEvaluating(e => ({ ...e, [qIdx]: true }))
    try {
      const res = await api('POST', '/evaluate/development', {
        question: questions[qIdx].question,
        model_answer: questions[qIdx].model_answer,
        user_answer: userAnswer,
        rubric: questions[qIdx].rubric,
      })
      setEvaluations(e => ({ ...e, [qIdx]: res }))
    } catch (err) { addToast(err.message, 'error') }
    finally { setEvaluating(e => ({ ...e, [qIdx]: false })) }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-lg font-bold text-slate-100">Preguntas de desarrollo</h2>

      {questions.map((q, i) => {
        const eval_ = evaluations[i]
        return (
          <div key={i} className="card space-y-3">
            {/* Question */}
            <div className="flex items-start gap-2">
              <span className="text-primary-400 font-bold text-sm shrink-0 mt-0.5">{i + 1}.</span>
              {/* La pregunta tambien pasa por el render: es donde mas aparece
                  una formula ("calcula 10^3..."), y verla en crudo ahi es peor
                  que en la respuesta. */}
              <div className="prose-studyai text-sm font-medium text-slate-100">
                <ReactMarkdown {...MD_OPTS}>{ensureMathDelimiters(q.question)}</ReactMarkdown>
              </div>
            </div>

            {q.points && <span className="badge-blue text-xs">{q.points} puntos</span>}

            {/* User answer */}
            <textarea
              rows={5}
              className="input resize-y text-sm"
              placeholder="Escribe tu respuesta aquí..."
              value={answers[i] || ''}
              onChange={e => setAnswers(a => ({ ...a, [i]: e.target.value }))}
            />

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => evaluateAnswer(i)}
                disabled={evaluating[i]}
                className="btn-primary btn-sm"
              >
                {evaluating[i] ? '⏳ Evaluando...' : '🤖 Evaluar respuesta'}
              </button>
              <button
                onClick={() => setShowModel(s => ({ ...s, [i]: !s[i] }))}
                className="btn-secondary btn-sm"
              >
                {showModel[i] ? 'Ocultar modelo' : '📋 Ver respuesta modelo'}
              </button>
            </div>

            {/* Model answer */}
            {showModel[i] && q.model_answer && (
              <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-600">
                <p className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wider">Respuesta modelo</p>
                <div className="prose-studyai text-sm">
                  <ReactMarkdown {...MD_OPTS}>{ensureMathDelimiters(q.model_answer)}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* AI evaluation */}
            {eval_ && (
              <div className={`rounded-xl p-4 border ${
                eval_.score >= 7 ? 'bg-emerald-900/20 border-emerald-700' :
                eval_.score >= 5 ? 'bg-yellow-900/20 border-yellow-700' :
                                   'bg-red-900/20 border-red-700'}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-sm">Evaluación</p>
                  <span className="text-2xl font-black text-slate-100">{eval_.score}/10</span>
                </div>
                <p className="text-sm text-slate-300">{eval_.feedback}</p>
                {eval_.missing_points?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-slate-400 font-medium">Falta mencionar:</p>
                    <ul className="text-xs text-slate-400 mt-1 space-y-0.5">
                      {eval_.missing_points.map((p, j) => <li key={j}>• {p}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
