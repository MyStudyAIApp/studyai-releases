import { useState, useEffect } from 'react'
import { useAppStore, api } from '../store/appStore'
import Spinner from '../components/UI/Spinner'
import ReactMarkdown from 'react-markdown'
import { useTranslation } from 'react-i18next'

export default function ComparePage() {
  const { t } = useTranslation()
  const { backendReady, addToast } = useAppStore()
  const [docs, setDocs] = useState([])
  const [docA, setDocA] = useState('')
  const [docB, setDocB] = useState('')
  const [mode, setMode] = useState('diff') // diff | common | both
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!backendReady) return
    api('GET', '/documents').then(r => setDocs(r.items || []))
  }, [backendReady])

  async function compare() {
    if (!docA || !docB) { addToast(t('compare.selectTwo'), 'warning'); return }
    if (docA === docB) { addToast(t('compare.selectDifferent'), 'warning'); return }
    setLoading(true)
    setResult(null)
    try {
      const res = await api('POST', '/compare', { doc_a: docA, doc_b: docB, mode })
      setResult(res)
    } catch (e) { addToast(e.message, 'error') }
    finally { setLoading(false) }
  }

  const nameA = docs.find(d => d.id === docA)?.title
  const nameB = docs.find(d => d.id === docB)?.title

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">{t('compare.title')}</h1>

      {/* Selector */}
      <div className="card space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">{t('compare.docA')}</label>
            <select className="input" value={docA} onChange={e => setDocA(e.target.value)}>
              <option value="">{t('compare.select')}</option>
              {docs.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">{t('compare.docB')}</label>
            <select className="input" value={docB} onChange={e => setDocB(e.target.value)}>
              <option value="">{t('compare.select')}</option>
              {docs.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          {[
            { value: 'diff',   label: t('compare.diff'),   desc: t('compare.diffDesc') },
            { value: 'common', label: t('compare.common'), desc: t('compare.commonDesc') },
            { value: 'both',   label: t('compare.both'),   desc: t('compare.bothDesc') },
          ].map(m => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              title={m.desc}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                ${mode === m.value ? 'bg-primary-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <button onClick={compare} disabled={loading || !docA || !docB} className="btn-primary w-full">
          {loading ? t('compare.comparing') : t('compare.compareBtn')}
        </button>
      </div>

      {/* Result */}
      {loading && <div className="flex justify-center py-12"><Spinner label={t('compare.analyzing')} /></div>}

      {result && !loading && (
        <div className="space-y-4 animate-fade-in">
          {/* Only in A */}
          {result.only_in_a?.length > 0 && (
            <div className="card border-l-4 border-blue-500">
              <h3 className="font-semibold text-blue-300 mb-2">{t('compare.onlyIn')} "{nameA}"</h3>
              <ul className="space-y-1">
                {result.only_in_a.map((t, i) => <li key={i} className="text-sm text-slate-300 flex gap-2"><span className="text-blue-400">→</span>{t}</li>)}
              </ul>
            </div>
          )}

          {/* Only in B */}
          {result.only_in_b?.length > 0 && (
            <div className="card border-l-4 border-purple-500">
              <h3 className="font-semibold text-purple-300 mb-2">{t('compare.onlyIn')} "{nameB}"</h3>
              <ul className="space-y-1">
                {result.only_in_b.map((t, i) => <li key={i} className="text-sm text-slate-300 flex gap-2"><span className="text-purple-400">→</span>{t}</li>)}
              </ul>
            </div>
          )}

          {/* Common */}
          {result.common?.length > 0 && (
            <div className="card border-l-4 border-emerald-500">
              <h3 className="font-semibold text-emerald-300 mb-2">{t('compare.inCommon')}</h3>
              <ul className="space-y-1">
                {result.common.map((t, i) => <li key={i} className="text-sm text-slate-300 flex gap-2"><span className="text-emerald-400">✓</span>{t}</li>)}
              </ul>
            </div>
          )}

          {/* Analysis */}
          {result.analysis && (
            <div className="card prose-studyai">
              <ReactMarkdown>{result.analysis}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
