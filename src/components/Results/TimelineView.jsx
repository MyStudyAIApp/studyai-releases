export default function TimelineView({ result }) {
  const { events = [] } = result

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-lg font-bold text-slate-100 mb-6">Línea del tiempo</h2>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-16 top-0 bottom-0 w-0.5 bg-slate-700" />

        <div className="space-y-6">
          {events.map((e, i) => (
            <div key={i} className="flex gap-6 items-start animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
              {/* Date */}
              <div className="w-14 text-right shrink-0">
                <span className="text-xs font-semibold text-primary-400 leading-tight">{e.date}</span>
              </div>

              {/* Dot */}
              <div className="relative z-10 w-3 h-3 rounded-full bg-primary-500 border-2 border-slate-900 mt-1 shrink-0" />

              {/* Content */}
              <div className="flex-1 card pb-3">
                <p className="font-semibold text-slate-100 text-sm">{e.title}</p>
                {e.description && <p className="text-xs text-slate-300 mt-1 leading-relaxed">{e.description}</p>}
                {e.importance && (
                  <span className={`mt-2 inline-block badge ${
                    e.importance === 'high' ? 'badge-red' :
                    e.importance === 'medium' ? 'badge-yellow' : 'badge-blue'
                  }`}>
                    {e.importance === 'high' ? '⚡ Importante' :
                     e.importance === 'medium' ? '📌 Relevante' : '📝 Dato'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
