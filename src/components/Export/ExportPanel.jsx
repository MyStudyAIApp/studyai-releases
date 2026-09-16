import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import { useState } from 'react'
import { useAppStore, getAuthHeader, getLocalAuthHeader } from '../../store/appStore'

export default function ExportPanel({ result, doc, onClose }) {
  useTranslation() // re-render al cambiar de idioma
  const { apiBase, addToast } = useAppStore()
  const [exporting, setExporting] = useState(null)

  async function exportAs(format) {
    if (!result) { addToast('No hay contenido para exportar', 'warning'); return }
    setExporting(format)
    try {
      const authHeader = await getAuthHeader()
      const localHeader = await getLocalAuthHeader()
      const res = await fetch(`${apiBase}/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader, ...localHeader },
        body: JSON.stringify({ result, doc_title: doc?.title || i18n.t('mobile.doc.document') }),
      })
      if (!res.ok) throw new Error(await res.text())

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const ext = format === 'word' ? 'docx' : 'pdf'
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc?.title || 'studyai'}_${result.type}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
      addToast(i18n.t('export.done', { ext: ext.toUpperCase() }), 'success')
    } catch (e) {
      addToast(`${i18n.t('export.error')}: ${e.message}`, 'error')
    } finally {
      setExporting(null)
    }
  }

  function printPage() {
    window.print()
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400 mb-4">
        Exportar: <span className="text-slate-200 font-medium">{result?.type || '—'}</span>
        {doc && <span className="text-slate-500"> de "{doc.title}"</span>}
      </p>

      <div className="space-y-2">
        <button
          onClick={printPage}
          className="w-full btn-secondary flex items-center gap-3 justify-start py-3"
        >
          <span className="text-xl">🖨️</span>
          <div className="text-left">
            <p className="font-medium text-sm">{i18n.t('whiteboard.print')}</p>
            <p className="text-xs text-slate-400">{i18n.t('export.printDesc')}</p>
          </div>
        </button>

        <button
          onClick={() => exportAs('word')}
          disabled={!!exporting}
          className="w-full btn-secondary flex items-center gap-3 justify-start py-3"
        >
          <span className="text-xl">📝</span>
          <div className="text-left">
            <p className="font-medium text-sm">
              {exporting === 'word' ? i18n.t('export.exporting') : i18n.t('export.word')}
            </p>
            <p className="text-xs text-slate-400">{i18n.t('export.wordDesc')}</p>
          </div>
          {exporting === 'word' && <span className="ml-auto animate-spin">⟳</span>}
        </button>

        <button
          onClick={() => exportAs('pdf')}
          disabled={!!exporting}
          className="w-full btn-secondary flex items-center gap-3 justify-start py-3"
        >
          <span className="text-xl">📄</span>
          <div className="text-left">
            <p className="font-medium text-sm">
              {exporting === 'pdf' ? i18n.t('export.exporting') : i18n.t('export.pdf')}
            </p>
            <p className="text-xs text-slate-400">{i18n.t('export.pdfDesc')}</p>
          </div>
          {exporting === 'pdf' && <span className="ml-auto animate-spin">⟳</span>}
        </button>
      </div>

      <p className="text-xs text-slate-500 pt-2">
        💡 {i18n.t('export.tip')}
      </p>
    </div>
  )
}
