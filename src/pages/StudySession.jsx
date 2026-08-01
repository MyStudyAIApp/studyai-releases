import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppStore, api } from '../store/appStore'
import Spinner from '../components/UI/Spinner'
import { useTranslation } from 'react-i18next'
import ProgressBar from '../components/UI/ProgressBar'
import { loadWeeklyHours, weeklyHoursTotal } from '../components/Study/WeeklyHoursWidget'
import {
  IconConfetti, IconTrophy, IconThumbUp, IconBook, IconBulb,
  IconCards, IconWritingSign, IconFileOff, IconTarget, IconChevronRight,
  IconCalendarStats,
} from '@tabler/icons-react'

function PendingDashboard({ onStartReview }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [pending, setPending] = useState(null)
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('GET', '/pending')
      .then(setPending)
      .catch(() => setPending(null))
      .finally(() => setLoading(false))
    api('GET', '/study-plans')
      .then(r => setPlans(r.items || []))
      .catch(() => {})
  }, [])

  if (loading) return <div className="flex justify-center items-center h-full"><Spinner label={t('study.pending.loading')} /></div>

  const weeklyGoalMinutes = weeklyHoursTotal(loadWeeklyHours()) * 60
  const weekMinutes = pending?.week_minutes_studied || 0
  const missingMinutes = weeklyGoalMinutes - weekMinutes
  const missingHoursLabel = missingMinutes > 0
    ? (missingMinutes >= 60 ? `${Math.round(missingMinutes / 60 * 10) / 10}h` : `${missingMinutes}min`)
    : null

  const tiles = []

  if (pending?.due_flashcards_count > 0) {
    tiles.push({
      key: 'flashcards',
      icon: IconCards,
      color: 'text-emerald-400 bg-emerald-500/10',
      title: t('study.pending.flashcardsTitle'),
      desc: t('study.pending.flashcardsDesc', { count: pending.due_flashcards_count }),
      onClick: onStartReview,
    })
  }

  if (pending?.subjects_without_exam?.length > 0) {
    tiles.push({
      key: 'exams',
      icon: IconWritingSign,
      color: 'text-amber-400 bg-amber-500/10',
      title: t('study.pending.examsTitle'),
      desc: pending.subjects_without_exam.map(s => s.name).join(', '),
      extra: t('study.pending.examsDesc'),
      onClick: () => navigate('/library'),
    })
  }

  if (pending?.untouched_documents?.length > 0) {
    tiles.push({
      key: 'docs',
      icon: IconFileOff,
      color: 'text-sky-400 bg-sky-500/10',
      title: t('study.pending.docsTitle'),
      desc: pending.untouched_documents.map(d => d.title).join(', '),
      extra: t('study.pending.docsDesc'),
      onClick: () => navigate(pending.untouched_documents.length === 1
        ? `/document/${pending.untouched_documents[0].id}`
        : '/library'),
    })
  }

  const unfinishedPlans = plans
    .filter(p => p.total_topics > 0 && p.done_topics < p.total_topics)
    .sort((a, b) => (a.exam_date || '9999') > (b.exam_date || '9999') ? 1 : -1)
  const activePlan = unfinishedPlans[0]

  if (activePlan) {
    const pct = Math.round((activePlan.done_topics / activePlan.total_topics) * 100)
    tiles.push({
      key: 'studyplan',
      icon: IconCalendarStats,
      color: 'text-indigo-400 bg-indigo-500/10',
      title: `Plan de estudio: ${activePlan.title}`,
      desc: `Te queda un ${100 - pct}% por terminar (${activePlan.done_topics}/${activePlan.total_topics} temas)`,
      onClick: async () => {
        try {
          const r = await api('GET', `/documents/${activePlan.doc_id}/results`)
          const item = (r.items || []).find(i => i.type === 'studyplan')
          navigate(`/document/${activePlan.doc_id}`, {
            state: { autoResult: item ? item.data : { ...activePlan, days: [] }, autoAction: 'studyplan' }
          })
        } catch {
          navigate(`/document/${activePlan.doc_id}`)
        }
      },
    })
  }

  if (missingHoursLabel) {
    tiles.push({
      key: 'weekly',
      icon: IconTarget,
      color: 'text-purple-400 bg-purple-500/10',
      title: t('study.pending.weeklyTitle'),
      desc: t('study.pending.weeklyDesc', { hours: missingHoursLabel }),
      onClick: () => navigate('/settings'),
    })
  }

  if (tiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <IconConfetti size={56} className="text-primary-400" />
        <h2 className="text-2xl font-bold text-slate-100">{t('study.pending.allDone')}</h2>
        <p className="text-slate-400">{t('study.pending.allDoneDesc')}</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto w-full p-6 space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">{t('study.pending.title')}</h2>
        <p className="text-slate-400 text-sm">{t('study.pending.subtitle')}</p>
      </div>
      <div className="space-y-3">
        {tiles.map(tile => (
          <button
            key={tile.key}
            onClick={tile.onClick}
            className="w-full flex items-center gap-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-primary-500 rounded-2xl p-4 transition-all text-left"
          >
            <span className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${tile.color}`}>
              <tile.icon size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-slate-100">{tile.title}</span>
              <span className="block text-sm text-slate-400 truncate">{tile.desc}</span>
              {tile.extra && <span className="block text-xs text-slate-500">{tile.extra}</span>}
            </span>
            <IconChevronRight size={18} className="text-slate-500 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}

export default function StudySession() {
  const { t } = useTranslation()
  const { subjectId } = useParams()
  const [mode, setMode] = useState(subjectId ? 'review' : 'dashboard')

  // SM-2 rating buttons (inside component so t() works)
  const RATINGS = [
    { value: 0, label: t('study.again'), color: 'bg-red-600 hover:bg-red-500',       key: '1' },
    { value: 1, label: t('study.hard'),  color: 'bg-orange-600 hover:bg-orange-500', key: '2' },
    { value: 3, label: t('study.good'),  color: 'bg-yellow-600 hover:bg-yellow-500', key: '3' },
    { value: 5, label: t('study.easy'),  color: 'bg-emerald-600 hover:bg-emerald-500', key: '4' },
  ]
  const { addToast, addStudyMinutes } = useAppStore()
  const [cards, setCards] = useState([])
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ reviewed: 0, correct: 0, total: 0 })
  const [startTime] = useState(Date.now())

  useEffect(() => {
    if (mode !== 'review') return
    const url = subjectId ? `/flashcards/due?subject_id=${subjectId}` : '/flashcards/due'
    api('GET', url)
      .then(res => {
        setCards(res.cards || [])
        setStats(s => ({ ...s, total: res.cards?.length || 0 }))
      })
      .catch(() => addToast(t('study.loadingCards'), 'error'))
      .finally(() => setLoading(false))
  }, [subjectId, mode])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === ' ') { e.preventDefault(); setFlipped(f => !f) }
      if (flipped) {
        const r = RATINGS.find(r => r.key === e.key)
        if (r) rateCard(r.value)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [flipped, current, cards])

  async function rateCard(rating) {
    const card = cards[current]
    try {
      await api('POST', `/flashcards/${card.id}/review`, { rating })
    } catch {}

    const correct = rating >= 3
    setStats(s => ({ ...s, reviewed: s.reviewed + 1, correct: s.correct + (correct ? 1 : 0) }))

    if (current + 1 >= cards.length) {
      const minutes = Math.round((Date.now() - startTime) / 60000)
      if (minutes > 0) {
        addStudyMinutes(minutes)
        api('POST', '/study-sessions', {
          subject_id: subjectId || null,
          cards_reviewed: stats.reviewed + 1,
          cards_correct: stats.correct + (correct ? 1 : 0),
          duration_minutes: minutes,
        }).catch(() => {})
      }
      setDone(true)
    } else {
      setCurrent(c => c + 1)
      setFlipped(false)
    }
  }

  if (mode === 'dashboard') {
    return <PendingDashboard onStartReview={() => { setLoading(true); setMode('review') }} />
  }

  if (loading) return <div className="flex justify-center items-center h-full"><Spinner label={t("study.loadingCards")} /></div>

  if (!cards.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <IconConfetti size={56} className="text-primary-400" />
        <h2 className="text-2xl font-bold text-slate-100">{t("study.allCaughtUp")}</h2>
        <p className="text-slate-400">{t("study.noPendingCards")}</p>
        {!subjectId && (
          <button onClick={() => setMode('dashboard')} className="text-primary-400 hover:text-primary-300 underline text-sm">
            {t('study.pending.backToDashboard')}
          </button>
        )}
      </div>
    )
  }

  if (done) {
    const pct = Math.round((stats.correct / stats.reviewed) * 100)
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 text-center p-8">
        {pct >= 80
          ? <IconTrophy size={56} className="text-amber-400" />
          : pct >= 60
          ? <IconThumbUp size={56} className="text-emerald-400" />
          : <IconBook size={56} className="text-primary-400" />}
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-1">{t('study.completed')}</h2>
          <p className="text-slate-400">{t('study.cardsReviewed', { count: stats.reviewed })}</p>
        </div>
        <div className="card w-64">
          <p className="text-5xl font-black mb-1">{pct}%</p>
          <p className="text-slate-400 text-sm">{t('study.correctOf', { correct: stats.correct, total: stats.reviewed })}</p>
          <ProgressBar value={stats.correct} max={stats.reviewed} color={pct >= 70 ? 'green' : pct >= 50 ? 'yellow' : 'red'} height="h-3" />
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setCurrent(0); setFlipped(false); setDone(false) }} className="btn-secondary">
            {t('study.reviewAgain')}
          </button>
          {!subjectId && (
            <button onClick={() => setMode('dashboard')} className="btn-secondary">
              {t('study.pending.backToDashboard')}
            </button>
          )}
        </div>
      </div>
    )
  }

  const card = cards[current]

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 gap-6 max-w-xl mx-auto w-full">
      {/* Progress */}
      <div className="w-full space-y-1">
        <div className="flex justify-between text-xs text-slate-400">
          <span>{current + 1} / {cards.length}</span>
          <span>{stats.correct} {t('study.correct')}</span>
        </div>
        <ProgressBar value={current + 1} max={cards.length} />
      </div>

      {/* Card subject */}
      {card.subject_name && <span className="badge-blue text-xs">{card.subject_name} · {card.document_title}</span>}

      {/* Flashcard */}
      <div
        className="flip-card w-full h-56 cursor-pointer select-none"
        onClick={() => setFlipped(f => !f)}
      >
        <div className={`flip-card-inner ${flipped ? 'flipped' : ''}`}>
          {/* Front */}
          <div className="flip-card-front card w-full h-full flex flex-col items-center justify-center text-center p-8 bg-slate-800 border-slate-700">
            <span className="text-xs text-slate-500 uppercase tracking-wider mb-4">{t('study.question')}</span>
            <p className="text-lg font-medium text-slate-100 leading-relaxed">{card.question}</p>
            <span className="mt-6 text-xs text-slate-600">{t('study.spaceToFlip')}</span>
          </div>
          {/* Back */}
          <div className="flip-card-back card w-full h-full flex flex-col items-center justify-center text-center p-8 bg-primary-900/30 border-primary-700">
            <span className="text-xs text-primary-400 uppercase tracking-wider mb-4">{t('study.answer')}</span>
            <p className="text-base text-slate-100 leading-relaxed">{card.answer}</p>
            {card.hint && <p className="text-sm text-slate-400 mt-4 italic flex items-center gap-1.5 justify-center"><IconBulb size={14} className="shrink-0" /> {card.hint}</p>}
            {card.explanation && <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5 justify-center"><IconBook size={13} className="shrink-0" /> {card.explanation}</p>}
          </div>
        </div>
      </div>

      {/* Rating buttons */}
      {flipped ? (
        <div className="w-full space-y-2">
          <p className="text-xs text-center text-slate-400">{t('study.howWasIt')}</p>
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map(r => (
              <button
                key={r.value}
                onClick={() => rateCard(r.value)}
                className={`${r.color} text-white font-medium py-3 rounded-xl text-sm transition-all duration-150 active:scale-95`}
              >
                {r.label}
                <span className="block text-[10px] opacity-60">[{r.key}]</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button onClick={() => setFlipped(true)} className="btn-primary px-8 py-3">
          {t('study.showAnswer')}
        </button>
      )}
    </div>
  )
}
