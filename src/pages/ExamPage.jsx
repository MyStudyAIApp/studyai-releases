import { useTranslation } from "react-i18next"
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppStore, api } from '../store/appStore'

export default function ExamPage() {
  const { t } = useTranslation()
  const { documentId } = useParams()
  const { backendReady } = useAppStore()
  const [docs, setDocs] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    if (!backendReady) return
    api('GET', '/documents').then(r => setDocs(r.items || []))
  }, [backendReady])

  if (documentId) {
    return navigate(`/document/${documentId}`, { replace: true })
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">{t("exam.title")}</h1>
      <p className="text-slate-400 mb-6">{t("exam.selectDoc")}</p>
      <div className="grid grid-cols-1 gap-3">
        {docs.map(doc => (
          <button
            key={doc.id}
            onClick={() => navigate(`/document/${doc.id}`)}
            className="card-hover flex items-center gap-4 text-left"
          >
            <span className="text-2xl">📄</span>
            <div>
              <p className="font-semibold text-slate-100">{doc.title}</p>
              <p className="text-xs text-slate-400">{doc.subject_name || t("exam.noSubject")} · {doc.pages} {t("exam.pages")}</p>
            </div>
            <span className="ml-auto text-slate-500 text-sm">→</span>
          </button>
        ))}
      </div>
    </div>
  )
}
