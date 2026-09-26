import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { IconSearch, IconLoader2 } from '@tabler/icons-react'
import { useAppStore, api } from '../store/appStore'

const TIPOS = ['summary', 'cards', 'exam']

// Sección Estudiar: primero qué quieres (resumen, tarjetas, examen), luego de
// qué apuntes. Con uno se abre ese documento; con varios se unen en uno nuevo
// (/documents/combine) y se genera sobre él. En ambos casos el documento se
// abre con la ventanita de opciones ya desplegada (state.openPanel).
export default function StudyPickerPage() {
  const { tipo } = useParams()
  const { t } = useTranslation()
  const { backendReady, addToast } = useAppStore()
  const navigate = useNavigate()
  const [docs, setDocs] = useState(null)
  const [selected, setSelected] = useState([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!backendReady) return
    api('GET', '/documents')
      .then(r => setDocs((r.items || []).filter(d => d.file_path !== '__combined__')))
      .catch(() => setDocs([]))
  }, [backendReady])

  useEffect(() => { setSelected([]) }, [tipo])

  if (!TIPOS.includes(tipo)) return <Navigate to="/crear/summary" replace />

  function toggle(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function next() {
    if (!selected.length || busy) return
    setBusy(true)
    try {
      const docId = selected.length === 1
        ? selected[0]
        : (await api('POST', '/documents/combine', { doc_ids: selected })).doc_id
      navigate(`/document/${docId}`, { state: { openPanel: tipo } })
    } catch (e) {
      addToast(`Error: ${e.message}`, 'error')
      setBusy(false)
    }
  }

  const q = query.trim().toLowerCase()
  const visible = (docs || [])
    .filter(d => !q || d.title?.toLowerCase().includes(q) || d.subject_name?.toLowerCase().includes(q))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  const groups = visible.reduce((acc, d) => {
    const k = d.subject_name || t('exam.noSubject')
    ;(acc[k] ||= []).push(d)
    return acc
  }, {})

  return (
    <div className="p-6 max-w-3xl mx-auto pb-28">
      <h1 className="text-2xl font-bold text-slate-100">{t(`actionPanel.main.${tipo}`)}</h1>
      <p className="text-slate-400 mb-5">{t('studyPicker.pick')}</p>

      <div className="relative mb-5">
        <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('studyPicker.search')} className="input text-sm pl-9" />
      </div>

      {docs === null && <IconLoader2 className="animate-spin text-slate-500" />}
      {docs?.length === 0 && <p className="text-sm text-slate-500">{t('studyPlanPage.noDocs')}</p>}

      <div className="space-y-5">
        {Object.entries(groups).map(([subject, list]) => (
          <div key={subject}>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">{subject}</p>
            <div className="space-y-1">
              {list.map(d => (
                <label key={d.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer border transition-colors
                  ${selected.includes(d.id) ? 'bg-primary-900/30 border-primary-700' : 'bg-slate-800/60 border-transparent hover:bg-slate-800'}`}>
                  <input type="checkbox" checked={selected.includes(d.id)} onChange={() => toggle(d.id)} className="accent-primary-500" />
                  <span className="text-sm text-slate-100 truncate flex-1">{d.title}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Botón fijo abajo: siempre a mano aunque la lista sea larga */}
      <div className="fixed bottom-0 inset-x-0 p-4 pointer-events-none flex justify-center">
        <button
          onClick={next}
          disabled={!selected.length || busy || selected.length > 10}
          className="btn-primary pointer-events-auto shadow-2xl px-6 py-3 disabled:opacity-40"
        >
          {busy ? <IconLoader2 size={16} className="animate-spin inline" />
            : selected.length > 10 ? t('studyPicker.max')
            : t('studyPicker.continue', { count: selected.length })}
        </button>
      </div>
    </div>
  )
}
