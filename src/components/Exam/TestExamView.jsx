import { useState, useEffect } from 'react'
import { useAppStore, api } from '../../store/appStore'

const OBJECTIVE_TYPES = ['test', 'true_false']
const OPEN_TYPES = ['development', 'problem']

export default function TestExamView({ result, doc, onFinished }) {
  const { questions = [], time_limit_minutes, is_timed } = result
  const { addToast } = useAppStore()
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [grading, setGrading] = useState(false)
  const [openScores, setOpenScores] = useState({}) // { [questionIdx]: { score_pct, feedback } }
  const [finalPct, setFinalPct] = useState(null)
  const timeMins = Number(time_limit_minutes) || 15
  const [timeLeft, setTimeLeft] = useState(is_timed ? timeMins * 60 : null)
  const [started, setStarted] = useState(!is_timed)

  // Timer
  useEffect(() => {
    if (!started || !timeLeft || submitted) return
    if (timeLeft <= 0) { handleSubmit(); return }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft, started, submitted])

  function handleAnswer(qIdx, value) {
    if (submitted) return
    setAnswers(a => ({ ...a, [qIdx]: value }))
  }

  function handleSubmit() {
    setSubmitted(true)
    gradeAndSave()
  }

  // Corrige con IA las preguntas de desarrollo/problema (las de test/V-F ya
  // llevan la respuesta correcta en el propio JSON generado) y calcula la
  // nota final combinando todos los tipos, no solo las de test.
  async function gradeAndSave() {
    const openItems = []
    const openIdxs = []
    questions.forEach((q, i) => {
      const type = q.type || 'test'
      if (OPEN_TYPES.includes(type) && (answers[i] || '').trim()) {
        openItems.push({
          question: q.question,
          type,
          expected: q.answer ?? q.solution ?? q.model_answer ?? '',
          student_answer: answers[i],
        })
        openIdxs.push(i)
      }
    })

    let scores = {}
    if (openItems.length > 0) {
      setGrading(true)
      try {
        const res = await api('POST', '/exams/grade-open', { items: openItems })
        openIdxs.forEach((qIdx, i) => { scores[qIdx] = res.results?.[i] || { score_pct: 0, feedback: '' } })
      } catch {
        openIdxs.forEach(qIdx => { scores[qIdx] = { score_pct: 0, feedback: 'No se pudo corregir esta respuesta.' } })
      } finally {
        setGrading(false)
      }
    }
    setOpenScores(scores)

    // Puntuación combinada: cada pregunta vale 1 punto, objetivas 1/0,
    // abiertas su score_pct/100 (0 si no se llegó a responder).
    let points = 0
    questions.forEach((q, i) => {
      const type = q.type || 'test'
      if (OBJECTIVE_TYPES.includes(type)) {
        if (answers[i] === (q.correct ?? q.correct_index)) points += 1
      } else {
        points += (scores[i]?.score_pct ?? 0) / 100
      }
    })
    const pct = questions.length > 0 ? Math.round((points / questions.length) * 100) : 0
    setFinalPct(pct)
    onFinished?.(pct)

    // Se sigue guardando el histórico solo con las de tipo test, para no
    // romper el resto de pantallas que ya leen /exams/results con ese shape.
    try {
      const testQs = questions.filter(q => (q.type || 'test') === 'test' || q.type === 'true_false')
      const score = testQs.filter((q) => {
        const idx = questions.indexOf(q)
        return answers[idx] === (q.correct ?? q.correct_index)
      }).length
      await api('POST', '/exams/results', {
        document_id: doc?.id,
        type: 'test',
        total: testQs.length,
        correct: score,
        answers,
        questions,
      })
    } catch {}
  }

  const formatTime = (s) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  // ── Pantalla de inicio (simulacro) ──────────────────────────────────────
  if (is_timed && !started) {
    const types = { test: 0, true_false: 0, development: 0, problem: 0 }
    questions.forEach(q => { types[q.type || 'test'] = (types[q.type || 'test'] || 0) + 1 })
    return (
      <div className="max-w-xl mx-auto text-center py-16 space-y-6">
        <div className="text-6xl">⏱️</div>
        <h2 className="text-2xl font-bold">Simulacro cronometrado</h2>
        <div className="card text-left space-y-2">
          <p className="text-slate-300 text-sm">📝 {questions.length} preguntas</p>
          {types.test > 0 && <p className="text-slate-400 text-xs pl-4">☑️ {types.test} tipo test</p>}
          {types.true_false > 0 && <p className="text-slate-400 text-xs pl-4">✅ {types.true_false} verdadero/falso</p>}
          {types.development > 0 && <p className="text-slate-400 text-xs pl-4">📄 {types.development} de desarrollo</p>}
          {types.problem > 0 && <p className="text-slate-400 text-xs pl-4">🔢 {types.problem} problema</p>}
          <p className="text-slate-300 text-sm">⏱️ {timeMins} minutos</p>
          <p className="text-slate-400 text-xs mt-2">Una vez que empieces, el tiempo no se puede pausar.</p>
        </div>
        <button onClick={() => setStarted(true)} className="btn-primary text-lg px-8 py-3">
          Empezar examen →
        </button>
      </div>
    )
  }

  // ── Corrigiendo con IA ───────────────────────────────────────────────────
  if (submitted && grading) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 space-y-4">
        <div className="text-5xl animate-pulse">🧠</div>
        <p className="text-slate-300 font-medium">Corrigiendo con IA…</p>
        <p className="text-slate-500 text-sm">Evaluando tus respuestas de desarrollo y problemas</p>
      </div>
    )
  }

  // ── Pantalla de resultados ───────────────────────────────────────────────
  if (submitted && finalPct !== null) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className={`card text-center py-8 border-2 ${
          finalPct >= 70 ? 'border-emerald-500 bg-emerald-900/20' :
          finalPct >= 50 ? 'border-yellow-500 bg-yellow-900/20' :
                     'border-red-500 bg-red-900/20'}`}>
          <p className="text-6xl font-black mb-2">{finalPct}%</p>
          <p className="text-xl font-semibold">{questions.length} preguntas · nota combinada</p>
          <p className="text-slate-400 mt-2">
            {finalPct >= 70 ? '🎉 ¡Excelente trabajo!' :
             finalPct >= 50 ? '📚 Aprobado, hay margen de mejora' :
                        '💪 Necesitas repasar más este tema'}
          </p>
        </div>

        <h3 className="font-semibold text-slate-200">Revisión</h3>
        <div className="space-y-4">
          {questions.map((q, i) => {
            const type = q.type || 'test'
            const userAns = answers[i]
            const correctIdx = q.correct ?? q.correct_index
            const isObjective = OBJECTIVE_TYPES.includes(type)
            const isCorrect = isObjective ? userAns === correctIdx : null
            const openScore = openScores[i]

            const typeLabel = type === 'test' ? 'TEST' : type === 'true_false' ? 'V/F' : type === 'development' ? 'DESARROLLO' : 'PROBLEMA'
            const typeColor = type === 'test' ? 'bg-primary-900 text-primary-300'
              : type === 'true_false' ? 'bg-cyan-900 text-cyan-300'
              : type === 'development' ? 'bg-amber-900 text-amber-300'
              : 'bg-purple-900 text-purple-300'

            return (
              <div key={i} className={`card border ${
                isObjective
                  ? isCorrect ? 'border-emerald-700/50' : 'border-red-700/50'
                  : 'border-slate-700'}`}>
                <div className="flex items-start gap-2 mb-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${typeColor}`}>{typeLabel}</span>
                  <p className="text-sm font-medium text-slate-100 flex-1">{q.question}</p>
                  {!isObjective && openScore && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${
                      openScore.score_pct >= 70 ? 'bg-emerald-900 text-emerald-300' :
                      openScore.score_pct >= 40 ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'}`}>
                      {openScore.score_pct}%
                    </span>
                  )}
                </div>

                {isObjective && q.options && (
                  <div className="space-y-1 ml-2">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className={`text-xs px-3 py-1.5 rounded-lg ${
                        oi === correctIdx ? 'bg-emerald-900/40 text-emerald-300 font-medium' :
                        oi === userAns && !isCorrect ? 'bg-red-900/40 text-red-300' :
                        'text-slate-400'}`}>
                        {type === 'true_false' ? String(opt) : `${String.fromCharCode(65 + oi)}) ${String(opt).replace(/^[A-Da-d][).]\s*/,'')}`}
                      </div>
                    ))}
                    {q.explanation && (
                      <p className="text-xs text-slate-400 mt-1 italic">💡 {q.explanation}</p>
                    )}
                  </div>
                )}

                {type === 'development' && (
                  <div className="ml-2 space-y-1">
                    {userAns && <p className="text-xs text-slate-300 bg-slate-800 p-2 rounded">Tu respuesta: {userAns}</p>}
                    <p className="text-xs text-emerald-300 bg-emerald-900/20 p-2 rounded">✅ Respuesta modelo: {q.answer}</p>
                    {openScore?.feedback && <p className="text-xs text-slate-400 italic">💬 {openScore.feedback}</p>}
                  </div>
                )}

                {type === 'problem' && (
                  <div className="ml-2 space-y-1">
                    {userAns && <p className="text-xs text-slate-300 bg-slate-800 p-2 rounded">Tu solución: {userAns}</p>}
                    <p className="text-xs text-purple-300 bg-purple-900/20 p-2 rounded">✅ Solución: {q.solution}</p>
                    {openScore?.feedback && <p className="text-xs text-slate-400 italic">💬 {openScore.feedback}</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Examen en curso ──────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur py-2 z-10">
        <div>
          <p className="font-semibold text-slate-100">{questions.length} preguntas</p>
          <p className="text-xs text-slate-400">{Object.keys(answers).length} respondidas</p>
        </div>
        {timeLeft !== null && (
          <span className={`font-mono text-lg font-bold ${timeLeft < 120 ? 'text-red-400 animate-pulse' : 'text-slate-200'}`}>
            {formatTime(timeLeft)}
          </span>
        )}
        <button
          onClick={handleSubmit}
          disabled={Object.keys(answers).length === 0}
          className="btn-primary"
        >
          Entregar
        </button>
      </div>

      {questions.map((q, i) => {
        const type = q.type || 'test'
        const isObjective = OBJECTIVE_TYPES.includes(type)
        const typeLabel = type === 'test' ? 'TEST' : type === 'true_false' ? 'V/F' : type === 'development' ? 'DESARROLLO' : 'PROBLEMA'
        const typeColor = type === 'test' ? 'bg-primary-900 text-primary-300'
          : type === 'true_false' ? 'bg-cyan-900 text-cyan-300'
          : type === 'development' ? 'bg-amber-900 text-amber-300'
          : 'bg-purple-900 text-purple-300'
        return (
          <div key={i} className="card">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-primary-400 font-bold text-sm">{i + 1}.</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${typeColor}`}>{typeLabel}</span>
              <p className="text-sm font-medium text-slate-100">{q.question}</p>
            </div>

            {isObjective && q.options && (
              <div className="space-y-2">
                {q.options.map((opt, oi) => (
                  <button key={oi} onClick={() => handleAnswer(i, oi)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-all border
                      ${answers[i] === oi
                        ? 'bg-primary-700/50 border-primary-500 text-primary-200 font-medium'
                        : 'bg-slate-700/30 border-slate-600 text-slate-300 hover:bg-slate-700'}`}>
                    {type === 'true_false'
                      ? String(opt)
                      : <><span className="font-semibold mr-2">{String.fromCharCode(65 + oi)})</span>{String(opt).replace(/^[A-Da-d][).]\s*/,'')}</>}
                  </button>
                ))}
              </div>
            )}

            {(type === 'development' || type === 'problem') && (
              <textarea
                className="input w-full text-sm min-h-[80px] resize-y"
                placeholder={type === 'development' ? 'Escribe tu respuesta...' : 'Escribe tu solución paso a paso...'}
                value={answers[i] || ''}
                onChange={e => handleAnswer(i, e.target.value)}
              />
            )}
          </div>
        )
      })}

      <button onClick={handleSubmit} className="btn-primary w-full py-3 mt-4">
        Entregar examen
      </button>
    </div>
  )
}
