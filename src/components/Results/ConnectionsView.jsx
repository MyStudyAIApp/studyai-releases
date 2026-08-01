export default function ConnectionsView({ result }) {
  const { connections = [], summary } = result

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h2 className="text-lg font-bold text-slate-100">Conexiones con otros temas</h2>
      {summary && <p className="text-sm text-slate-300">{summary}</p>}

      <div className="space-y-3">
        {connections.map((c, i) => (
          <div key={i} className="card">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">🔗</span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-primary-300">{c.concept_a}</span>
                  <span className="text-slate-500">↔</span>
                  <span className="font-semibold text-emerald-300">{c.concept_b}</span>
                  {c.relation_type && <span className="badge-purple text-[10px]">{c.relation_type}</span>}
                </div>
                <p className="text-sm text-slate-300 mt-1">{c.explanation}</p>
                {c.topics?.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {c.topics.map((t, j) => <span key={j} className="badge-blue text-[10px]">{t}</span>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
