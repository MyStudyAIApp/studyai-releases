import { useState, useEffect, useMemo } from 'react'

// ─── Juego 1: Memoria de parejas ───────────────────────────────────────────
const EMOJIS = ['📚', '✏️', '🔬', '🧮', '🌍', '🧠', '⚗️', '📐']

function shuffledDeck() {
  const pairs = [...EMOJIS, ...EMOJIS]
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pairs[i], pairs[j]] = [pairs[j], pairs[i]]
  }
  return pairs.map((emoji, i) => ({ id: i, emoji, matched: false }))
}

function MemoryGame({ onWin }) {
  const [deck, setDeck] = useState(shuffledDeck)
  const [flipped, setFlipped] = useState([])
  const [moves, setMoves] = useState(0)
  const matchedCount = useMemo(() => deck.filter(c => c.matched).length, [deck])
  const won = matchedCount === deck.length

  useEffect(() => {
    if (flipped.length !== 2) return
    const [a, b] = flipped
    setMoves(m => m + 1)
    if (deck[a].emoji === deck[b].emoji) {
      setDeck(prev => prev.map((c, i) => (i === a || i === b) ? { ...c, matched: true } : c))
      setFlipped([])
    } else {
      const t = setTimeout(() => setFlipped([]), 700)
      return () => clearTimeout(t)
    }
  }, [flipped, deck])

  useEffect(() => { if (won) { const t = setTimeout(onWin, 1200); return () => clearTimeout(t) } }, [won])

  function onCardClick(i) {
    if (flipped.length === 2 || flipped.includes(i) || deck[i].matched) return
    setFlipped(prev => [...prev, i])
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs text-slate-500">
        {won ? `¡Completado en ${moves} intentos! 🎉` : 'Memoria: encuentra las parejas'}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {deck.map((card, i) => {
          const isFlipped = flipped.includes(i) || card.matched
          return (
            <button
              key={card.id}
              onClick={() => onCardClick(i)}
              className={`w-12 h-12 rounded-lg text-xl flex items-center justify-center transition-all
                ${isFlipped
                  ? card.matched ? 'bg-emerald-900/50 border border-emerald-600' : 'bg-primary-900/50 border border-primary-600'
                  : 'bg-slate-800 border border-slate-700 hover:border-slate-600'}`}
            >
              {isFlipped ? card.emoji : ''}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Juego 2: 3 en raya contra un bot sencillo ─────────────────────────────
const LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
]

function checkWinner(board) {
  for (const [a,b,c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a]
  }
  if (board.every(Boolean)) return 'draw'
  return null
}

// IA mínima: gana si puede, bloquea si hace falta, si no juega centro/aleatorio.
function botMove(board) {
  const empties = board.map((v, i) => v ? null : i).filter(i => i !== null)
  for (const i of empties) {
    const copy = [...board]; copy[i] = 'O'
    if (checkWinner(copy) === 'O') return i
  }
  for (const i of empties) {
    const copy = [...board]; copy[i] = 'X'
    if (checkWinner(copy) === 'X') return i
  }
  if (board[4] === null) return 4
  return empties[Math.floor(Math.random() * empties.length)]
}

function TicTacToe({ onWin }) {
  const [board, setBoard] = useState(Array(9).fill(null))
  const [turn, setTurn] = useState('X') // el usuario siempre es X
  const winner = checkWinner(board)

  useEffect(() => {
    if (winner || turn !== 'O') return
    const t = setTimeout(() => {
      const i = botMove(board)
      if (i !== undefined) setBoard(prev => { const n = [...prev]; n[i] = 'O'; return n })
      setTurn('X')
    }, 500)
    return () => clearTimeout(t)
  }, [turn, board, winner])

  useEffect(() => {
    if (winner === 'X') { const t = setTimeout(onWin, 1400); return () => clearTimeout(t) }
    if (winner) { const t = setTimeout(() => { setBoard(Array(9).fill(null)); setTurn('X') }, 1400); return () => clearTimeout(t) }
  }, [winner])

  function onCellClick(i) {
    if (board[i] || winner || turn !== 'X') return
    setBoard(prev => { const n = [...prev]; n[i] = 'X'; return n })
    setTurn('O')
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs text-slate-500">
        {winner === 'X' ? '¡Has ganado! 🎉' : winner === 'O' ? 'Ha ganado la máquina, va otra...' : winner === 'draw' ? 'Empate, va otra...' : '3 en raya — eres las X'}
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {board.map((v, i) => (
          <button
            key={i}
            onClick={() => onCellClick(i)}
            className="w-12 h-12 rounded-lg text-lg font-bold flex items-center justify-center bg-slate-800 border border-slate-700 hover:border-slate-600 disabled:hover:border-slate-700"
            disabled={!!v || !!winner || turn !== 'X'}
          >
            <span className={v === 'X' ? 'text-primary-400' : 'text-amber-400'}>{v}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Juego 3: Simón — repite la secuencia de colores ───────────────────────
const SIMON_COLORS = [
  { base: 'bg-red-700',    lit: 'bg-red-400' },
  { base: 'bg-blue-700',   lit: 'bg-blue-400' },
  { base: 'bg-yellow-700', lit: 'bg-yellow-400' },
  { base: 'bg-emerald-700',lit: 'bg-emerald-400' },
]
const SIMON_TARGET_ROUNDS = 6

function SimonGame({ onWin }) {
  const [sequence, setSequence] = useState([])
  const [userStep, setUserStep] = useState(0)
  const [litIdx, setLitIdx] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | showing | input | wrong
  const won = sequence.length > SIMON_TARGET_ROUNDS

  // Arranca / añade una ronda nueva a la secuencia
  useEffect(() => {
    if (phase !== 'idle') return
    const t = setTimeout(() => {
      setSequence(prev => [...prev, Math.floor(Math.random() * 4)])
      setUserStep(0)
      setPhase('showing')
    }, 600)
    return () => clearTimeout(t)
  }, [phase])

  // Reproduce la secuencia actual, una casilla iluminada cada vez
  useEffect(() => {
    if (phase !== 'showing') return
    let i = 0
    const interval = setInterval(() => {
      setLitIdx(sequence[i])
      setTimeout(() => setLitIdx(null), 350)
      i++
      if (i >= sequence.length) {
        clearInterval(interval)
        setTimeout(() => setPhase('input'), 500)
      }
    }, 600)
    return () => clearInterval(interval)
  }, [phase, sequence])

  useEffect(() => {
    if (won) { const t = setTimeout(onWin, 1400); return () => clearTimeout(t) }
  }, [won])

  function onColorClick(i) {
    if (phase !== 'input') return
    setLitIdx(i)
    setTimeout(() => setLitIdx(null), 200)
    if (sequence[userStep] !== i) {
      setPhase('wrong')
      setTimeout(() => { setSequence([]); setUserStep(0); setPhase('idle') }, 1200)
      return
    }
    if (userStep + 1 === sequence.length) {
      setPhase('idle') // ronda completada, se añade la siguiente
    } else {
      setUserStep(s => s + 1)
    }
  }

  const label = won ? '¡Memoria de acero! 🎉'
    : phase === 'wrong' ? 'Fallaste, empezamos de nuevo...'
    : phase === 'showing' ? 'Memoriza la secuencia...'
    : phase === 'input' ? `Tu turno — ronda ${sequence.length}/${SIMON_TARGET_ROUNDS}`
    : 'Simón — repite la secuencia de colores'

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {SIMON_COLORS.map((c, i) => (
          <button
            key={i}
            onClick={() => onColorClick(i)}
            disabled={phase !== 'input'}
            className={`w-12 h-12 rounded-lg transition-colors ${litIdx === i ? c.lit : c.base} disabled:cursor-default`}
          />
        ))}
      </div>
    </div>
  )
}

const GAMES = [MemoryGame, TicTacToe, SimonGame]

function pickGame(excludeIdx) {
  let idx
  do { idx = Math.floor(Math.random() * GAMES.length) } while (GAMES.length > 1 && idx === excludeIdx)
  return idx
}

// Mini juego mostrado solo mientras se espera una generación larga — no
// necesita datos ni conexión, es puro estado local. Al ganar una partida,
// cambia a otro juego aleatorio distinto del actual.
export default function WaitingGame() {
  const [gameIdx, setGameIdx] = useState(() => pickGame(-1))
  const [round, setRound] = useState(0)
  const Game = GAMES[gameIdx]

  function nextGame() {
    setGameIdx(prev => pickGame(prev))
    setRound(r => r + 1)
  }

  return <Game key={round} onWin={nextGame} />
}
