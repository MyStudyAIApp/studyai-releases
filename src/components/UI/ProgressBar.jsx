export default function ProgressBar({ value = 0, max = 100, label = '', color = 'primary', height = 'h-2' }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const colors = {
    primary: 'bg-primary-500',
    green:   'bg-emerald-500',
    yellow:  'bg-yellow-500',
    red:     'bg-red-500',
    purple:  'bg-purple-500',
  }
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>{label}</span>
          <span>{pct}%</span>
        </div>
      )}
      <div className={`progress-bar ${height}`}>
        <div
          className={`progress-fill ${height} ${colors[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
