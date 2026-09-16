import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import { useState } from 'react'

export default function GlossaryView({ result }) {
  useTranslation() // re-render al cambiar de idioma
  const { terms = [] } = result
  const [search, setSearch] = useState('')

  const filtered = search
    ? terms.filter(t => t.term.toLowerCase().includes(search.toLowerCase()) || t.definition.toLowerCase().includes(search.toLowerCase()))
    : terms

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <input
          className="input flex-1"
          placeholder={i18n.t('glossary.search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="text-sm text-slate-400 shrink-0">{i18n.t('summary.terms', { count: filtered.length })}</span>
      </div>

      <div className="space-y-2">
        {filtered.map((t, i) => (
          <div key={i} className="card">
            <div className="flex items-start gap-3">
              <span className="text-primary-400 font-semibold text-sm mt-0.5 w-6 shrink-0">{i + 1}</span>
              <div>
                <p className="font-semibold text-slate-100">{t.term}</p>
                <p className="text-sm text-slate-300 mt-1">{t.definition}</p>
                {t.example && <p className="text-xs text-slate-400 mt-1 italic">{i18n.t('glossary.example')}: {t.example}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
