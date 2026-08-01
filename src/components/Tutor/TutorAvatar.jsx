// Estado del tutor reflejado en el avatar
export default function TutorAvatar({ state = 'idle', size = 48 }) {
  const cfg = {
    idle:       { emoji: '🦉', bg: 'from-violet-600 to-purple-800' },
    thinking:   { emoji: '🤔', bg: 'from-violet-600 to-purple-800' },
    responding: { emoji: '💬', bg: 'from-violet-600 to-purple-800' },
    explaining: { emoji: '📖', bg: 'from-violet-600 to-purple-800' },
    happy:      { emoji: '😊', bg: 'from-violet-600 to-purple-800' },
    error:      { emoji: null,  bg: 'from-red-600 to-red-800', label: 'FAIL' },
  }[state] ?? { emoji: '🦉', bg: 'from-violet-600 to-purple-800' }

  return (
    <div
      className={`rounded-full bg-gradient-to-br ${cfg.bg} flex items-center justify-center shrink-0 shadow-lg ring-2 ring-white/10`}
      style={{ width: size, height: size }}
    >
      {cfg.label
        ? <span className="text-white font-black tracking-wide" style={{ fontSize: size * 0.28 }}>{cfg.label}</span>
        : <span style={{ fontSize: size * 0.52, lineHeight: 1 }}>{cfg.emoji}</span>
      }
    </div>
  )
}
