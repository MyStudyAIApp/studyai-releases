import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, api } from '../store/appStore'
import LectureRecorder from '../components/Audio/LectureRecorder'
import Spinner from '../components/UI/Spinner'
import { useTranslation } from 'react-i18next'

export default function LecturePage() {
  const { t } = useTranslation()
  const { backendReady, addToast } = useAppStore()
  const [subjects, setSubjects]       = useState([])
  const [selectedSubject, setSelectedSubject] = useState('')
  const [recentLectures, setRecentLectures]   = useState([])
  const [loadingRecent, setLoadingRecent]     = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!backendReady) return
    Promise.all([
      api('GET', '/subjects'),
      api('GET', '/documents'),
    ]).then(([subs, docs]) => {
      setSubjects(subs.items || [])
      // Only show [Clase] documents
      const lectures = (docs.items || [])
        .filter(d => d.title.startsWith('[Apuntes]'))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10)
      setRecentLectures(lectures)
    }).catch(() => {})
    .finally(() => setLoadingRecent(false))
  }, [backendReady])

  function handleSaved() {
    api('GET', '/documents').then(docs => {
      const lectures = (docs.items || [])
        .filter(d => d.title.startsWith('[Apuntes]'))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10)
      setRecentLectures(lectures)
    }).catch(() => {})
  }

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden overflow-y-auto md:overflow-y-hidden">

      {/* ── Left: recorder ── */}
      <div data-tour="lecture-recorder" className="w-full md:w-[420px] shrink-0 border-b md:border-b-0 md:border-r border-slate-800 md:overflow-y-auto p-5 space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            {t('lecture.title')}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {t('lecture.description')}
          </p>
        </div>

        {/* Subject selector */}
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1.5">
            {t('lecture.subjectLabel')} <span className="text-slate-600">{t('lecture.subjectOptional')}</span>
          </label>
          <select
            className="input w-full"
            value={selectedSubject}
            onChange={e => setSelectedSubject(e.target.value)}
          >
            <option value="">{t('lecture.noSubject')}</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Recorder component */}
        <LectureRecorder
          subjectId={selectedSubject}
          onTranscriptionSaved={handleSaved}
        />

        {/* Info */}
        <div className="card bg-slate-900/40 border-slate-700/50 space-y-2 text-xs text-slate-500">
          <p className="font-medium text-slate-400">{t('lecture.aiDoes')}</p>
          <p>{t('lecture.aiStep1')}</p>
          <p>{t('lecture.aiStep2')}</p>
          <p>{t('lecture.aiStep3')}</p>
          <p>{t('lecture.aiStep4')}</p>
        </div>
      </div>

      {/* ── Right: recent lectures ── */}
      <div className="flex-1 md:overflow-y-auto p-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          {t('lecture.recentLectures')}
        </h2>

        {loadingRecent ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : recentLectures.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-slate-500">
            <span className="text-5xl mb-4">🎙️</span>
            <p className="font-medium text-slate-400">{t('lecture.noLectures')}</p>
            <p className="text-sm mt-1">{t('lecture.firstLecture')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentLectures.map(doc => (
              <div
                key={doc.id}
                onClick={() => navigate(`/document/${doc.id}`)}
                className="card-hover flex items-start gap-3 cursor-pointer group"
              >
                <span className="text-2xl shrink-0 mt-0.5">🎙️</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-100 truncate">
                    {doc.title.replace('[Apuntes] ', '')}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {doc.subject_name && (
                      <span className="badge-blue text-[10px]">{doc.subject_name}</span>
                    )}
                    {doc.has_summary && (
                      <span className="badge-green text-[10px]">{t('lecture.summary')}</span>
                    )}
                    <span className="text-xs text-slate-500">
                      {new Date(doc.created_at).toLocaleDateString('es-ES', {
                        weekday: 'short', day: 'numeric', month: 'short'
                      })}
                    </span>
                  </div>
                </div>
                <span className="text-slate-600 group-hover:text-slate-300 transition-colors text-sm">→</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
