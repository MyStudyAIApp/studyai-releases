import { useState } from 'react'
import { useAppStore, api } from '../../store/appStore'

export default function FlashcardsResult({ result, doc }) {
  const { cards = [] } = result
  const { addToast } = useAppStore()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [mode, setMode] = useState('browse') // browse | study

  async function saveDeck() {
    setSaving(true)
    try {
      await api('POST', '/flashcards/save', { document_id: doc.id, cards })
      setSaved(true)
      addToast(`${cards.length} tarjetas guardadas para estudio`, 'success')
    } catch (e) { addToast(e.message, 'error') }
    finally { setSaving(false) }
  }

  const card = cards[current]

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Flashcards</h2>
          <p className="text-sm text-slate-400">{cards.length} tarjetas generadas</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMode(m => m === 'browse' ? 'study' : 'browse')}
            className="btn-secondary btn-sm"
          >
            {mode === 'browse' ? '🧠 Modo estudio' : '📋 Ver todas'}
          </button>
          {!saved && (
            <button onClick={saveDeck} disabled={saving} className="btn-primary btn-sm">
              {saving ? '⏳' : '💾'} Guardar deck
            </button>
          )}
          {saved && <span className="badge-green">✓ Guardado</span>}
        </div>
      </div>

      {mode === 'study' && card ? (
        /* Study mode — one card at a time with flip */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>{current + 1} / {cards.length}</span>
            <span>Haz clic para voltear</span>
          </div>

          {/* Card */}
          <div
            className="flip-card h-64 cursor-pointer"
            onClick={() => setFlipped(f => !f)}
          >
            <div className={`flip-card-inner ${flipped ? 'flipped' : ''}`}>
              {/* Front */}
              <div className="flip-card-front card flex flex-col items-center justify-center text-center p-8 bg-slate-800">
                <span className="text-xs text-slate-500 uppercase tracking-wider mb-3">Pregunta</span>
                <p className="text-lg font-medium text-slate-100">{card.question}</p>
                <span className="mt-4 text-xs text-slate-500">▸ Click para ver respuesta</span>
              </div>
              {/* Back */}
              <div className="flip-card-back card flex flex-col items-center justify-center text-center p-8 bg-primary-900/30 border-primary-700">
                <span className="text-xs text-primary-400 uppercase tracking-wider mb-3">Respuesta</span>
                <p className="text-base text-slate-100">{card.answer}</p>
                {card.hint && <p className="text-sm text-slate-400 mt-3 italic">💡 {card.hint}</p>}
                {card.explanation && <p className="text-xs text-slate-500 mt-2">📖 {card.explanation}</p>}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => { setCurrent(c => Math.max(0, c - 1)); setFlipped(false) }}
              disabled={current === 0}
              className="btn-secondary flex-1"
            >
              ← Anterior
            </button>
            <button
              onClick={() => { setCurrent(c => Math.min(cards.length - 1, c + 1)); setFlipped(false) }}
              disabled={current === cards.length - 1}
              className="btn-primary flex-1"
            >
              Siguiente →
            </button>
          </div>
        </div>
      ) : (
        /* Browse mode — all cards */
        <div className="space-y-2">
          {cards.map((c, i) => (
            <div
              key={i}
              onClick={() => { setCurrent(i); setFlipped(false); setMode('study') }}
              className="card-hover grid grid-cols-2 gap-4"
            >
              <div>
                <p className="text-[10px] text-slate-500 uppercase mb-1">Pregunta</p>
                <p className="text-sm text-slate-200">{c.question}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase mb-1">Respuesta</p>
                <p className="text-sm text-slate-300">{c.answer}</p>
                {c.explanation && <p className="text-xs text-slate-500 mt-1">📖 {c.explanation}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
