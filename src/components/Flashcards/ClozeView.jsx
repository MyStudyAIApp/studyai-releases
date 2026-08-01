import { useState } from 'react'

export default function ClozeView({ result }) {
  const { passages = [] } = result
  const [answers, setAnswers] = useState({})
  const [checked, setChecked] = useState({})
  const [revealed, setRevealed] = useState({})

  function check(passageIdx, blankIdx, value) {
    const key = `${passageIdx}-${blankIdx}`
    const correct = passages[passageIdx].blanks[blankIdx].answer.toLowerCase()
    setChecked(c => ({ ...c, [key]: value.trim().toLowerCase() === correct }))
  }

  function reveal(passageIdx, blankIdx) {
    const key = `${passageIdx}-${blankIdx}`
    setRevealed(r => ({ ...r, [key]: true }))
    setAnswers(a => ({ ...a, [key]: passages[passageIdx].blanks[blankIdx].answer }))
  }

  const score = Object.values(checked).filter(Boolean).length
  const total = Object.values(checked).length

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-100">Texto con huecos</h2>
        {total > 0 && (
          <span className={`badge ${score === total ? 'badge-green' : score > total / 2 ? 'badge-yellow' : 'badge-red'}`}>
            {score}/{total} correctos
          </span>
        )}
      </div>

      {passages.map((passage, pi) => (
        <div key={pi} className="card space-y-3">
          <p className="text-sm text-slate-400 mb-3">{passage.topic && `📌 ${passage.topic}`}</p>
          <div className="text-sm text-slate-200 leading-loose">
            {renderPassage(passage, pi, answers, checked, revealed, setAnswers, check, reveal)}
          </div>
        </div>
      ))}
    </div>
  )
}

function renderPassage(passage, pi, answers, checked, revealed, setAnswers, check, reveal) {
  const parts = passage.text.split(/\[BLANK_(\d+)\]/)
  return parts.map((part, idx) => {
    if (idx % 2 === 0) return <span key={idx}>{part}</span>
    const blankIdx = parseInt(part)
    const key = `${pi}-${blankIdx}`
    const isChecked = key in checked
    const isCorrect = checked[key]
    const isRevealed = revealed[key]

    return (
      <span key={idx} className="inline-flex items-center gap-1 mx-0.5">
        <input
          type="text"
          value={answers[key] || ''}
          onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))}
          onBlur={e => { if (e.target.value.trim()) check(pi, blankIdx, e.target.value) }}
          disabled={isRevealed}
          className={`inline-block border-b-2 bg-transparent outline-none text-center w-24 px-1 text-sm transition-colors
            ${isChecked ? (isCorrect ? 'border-emerald-400 text-emerald-300' : 'border-red-400 text-red-300')
                        : 'border-slate-500 hover:border-primary-400 focus:border-primary-400 text-slate-100'}`}
          placeholder="___"
        />
        {!isRevealed && (
          <button
            onClick={() => reveal(pi, blankIdx)}
            className="text-[10px] text-slate-500 hover:text-slate-300"
            title="Ver respuesta"
          >
            👁️
          </button>
        )}
        {isChecked && !isCorrect && !isRevealed && (
          <span className="text-[10px] text-red-400">{passage.blanks[blankIdx].answer}</span>
        )}
      </span>
    )
  })
}
