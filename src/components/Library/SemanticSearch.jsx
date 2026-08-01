import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../store/appStore'

export default function SemanticSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function search(e) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await api('GET', `/search?q=${encodeURIComponent(query)}`)
      setResults(res.results || [])
    } catch {}
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={search} className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Buscar en todos los documentos..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? '⏳' : '🔍'}
        </button>
      </form>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              onClick={() => navigate(`/document/${r.id}`)}
              className="card-hover"
            >
              <p className="font-medium text-sm text-slate-100 mb-1">{r.title}</p>
              <p className="text-xs text-slate-400 line-clamp-2">{r.excerpt}</p>
            </div>
          ))}
        </div>
      )}

      {results.length === 0 && query && !loading && (
        <p className="text-sm text-slate-500 text-center py-4">No se encontraron resultados</p>
      )}
    </div>
  )
}
