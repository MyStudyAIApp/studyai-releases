import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { useAppStore, api } from '../../store/appStore'
import { ensureMathDelimiters } from '../../utils/mathText'

const MD_OPTS = { remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex] }

export default function ProblemsView({ result }) {
  const { problems = [] } = result
  const practiceMode = result.type === 'problems_new'
  const [expanded, setExpanded] = useState({})
  const { addToast } = useAppStore()
  const [answers, setAnswers] = useState({})
  const [evaluations, setEvaluations] = useState({})
  const [evaluating, setEvaluating] = useState({})

  async function evaluateAnswer(i, p) {
    const userAnswer = answers[i]
    if (!userAnswer?.trim()) { addToast('Escribe tu respuesta primero', 'warning'); return }
    setEvaluating(e => ({ ...e, [i]: true }))
    try {
      const res = await api('POST', '/evaluate/problem', {
        statement: p.statement,
        correct_answer: p.answer,
        steps: p.steps || [],
        user_answer: userAnswer,
      })
      setEvaluations(e => ({ ...e, [i]: res }))
    } catch (err) { addToast(err.message, 'error') }
    finally { setEvaluating(e => ({ ...e, [i]: false })) }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h2 className="text-lg font-bold text-slate-100">{practiceMode ? 'Practicar con problemas nuevos' : 'Problemas resueltos'}</h2>

      {problems.map((p, i) => {
        const eval_ = evaluations[i]
        return (
        <div key={i} className="card space-y-3">
          {/* Statement */}
          <div className="flex items-start gap-3">
            <span className="bg-primary-700 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {p.topic && <span className="badge-blue text-[10px]">{p.topic}</span>}
                {p.difficulty && (
                  <span className={`badge text-[10px] ${
                    p.difficulty === 'hard' ? 'badge-red' :
                    p.difficulty === 'medium' ? 'badge-yellow' : 'badge-green'}`}>
                    {p.difficulty === 'hard' ? '🔴 Difícil' :
                     p.difficulty === 'medium' ? '🟡 Medio' : '🟢 Fácil'}
                  </span>
                )}
              </div>
              <div className="prose-studyai text-sm">
                <ReactMarkdown {...MD_OPTS}>{ensureMathDelimiters(p.statement)}</ReactMarkdown>
              </div>
            </div>
          </div>

          {practiceMode ? (
            <>
              {/* Escribir respuesta */}
              <textarea
                rows={4}
                className="input resize-y text-sm"
                placeholder="Escribe tu solución paso a paso..."
                value={answers[i] || ''}
                onChange={e => setAnswers(a => ({ ...a, [i]: e.target.value }))}
              />

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => evaluateAnswer(i, p)}
                  disabled={evaluating[i]}
                  className="btn-primary btn-sm"
                >
                  {evaluating[i] ? '⏳ Evaluando...' : '🤖 Evaluar respuesta'}
                </button>
                <button
                  onClick={() => setExpanded(e => ({ ...e, [i]: !e[i] }))}
                  className="btn-secondary btn-sm"
                >
                  {expanded[i] ? 'Ocultar solución' : '📋 Ver solución'}
                </button>
              </div>

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
                        {eval_.missing_points.map((mp, j) => <li key={j}>• {mp}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <button
              onClick={() => setExpanded(e => ({ ...e, [i]: !e[i] }))}
              className="w-full flex items-center justify-between px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-sm"
            >
              <span className="font-medium text-slate-300">
                {expanded[i] ? '▲ Ocultar solución' : '▼ Ver solución paso a paso'}
              </span>
            </button>
          )}

          {expanded[i] && (
            <div className="space-y-3 animate-fade-in">
              {/* Steps */}
              {p.steps?.map((step, si) => (
                <div key={si} className="flex gap-3 items-start">
                  <span className="w-5 h-5 rounded-full bg-primary-800 text-primary-200 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">
                    {si + 1}
                  </span>
                  <div className="flex-1 prose-studyai text-sm">
                    <ReactMarkdown {...MD_OPTS}>{step}</ReactMarkdown>
                  </div>
                </div>
              ))}

              {/* Final answer */}
              {p.answer && (
                <div className="bg-emerald-900/30 border border-emerald-700 rounded-xl px-4 py-3">
                  <p className="text-xs text-emerald-400 font-semibold uppercase mb-1">Resultado</p>
                  <div className="prose-studyai text-sm font-semibold">
                    <ReactMarkdown {...MD_OPTS}>{p.answer}</ReactMarkdown>
                  </div>
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
