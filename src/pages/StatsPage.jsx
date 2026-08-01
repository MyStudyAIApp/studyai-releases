import { useState, useEffect } from 'react'
import { useAppStore, api } from '../store/appStore'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import Spinner from '../components/UI/Spinner'
import { useTranslation } from 'react-i18next'
import ProgressBar from '../components/UI/ProgressBar'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']

export default function StatsPage() {
  const { t } = useTranslation()
  const { backendReady } = useAppStore()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!backendReady) return
    api('GET', '/stats/overview')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [backendReady])

  if (loading) return <div className="flex justify-center items-center h-full"><Spinner label={t("stats.loadingStats")} /></div>
  if (!stats) return null

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-slate-100">{t("stats.title")}</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('stats.cardsStudied'), value: stats.total_cards_reviewed, icon: '🃏', color: 'blue' },
          { label: t('stats.examsCompleted'), value: stats.total_exams, icon: '📝', color: 'purple' },
          { label: t('stats.avgScore'),          value: `${stats.avg_score}%`, icon: '⭐', color: 'yellow' },
          { label: t('stats.streakDays'),        value: stats.streak_days, icon: '🔥', color: 'green' },
        ].map((k, i) => (
          <div key={i} className="card text-center py-4">
            <span className="text-3xl">{k.icon}</span>
            <p className="text-3xl font-black text-slate-100 mt-1">{k.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Study activity */}
      {stats.daily_activity?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-slate-200 mb-4">{t("stats.studyActivity")}</h3>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={stats.daily_activity}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={24} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area type="monotone" dataKey="cards" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name={t("stats.cards")} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Exam scores */}
      {stats.exam_scores?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-slate-200 mb-4">{t("stats.scoreEvolution")}</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={stats.exam_scores}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} width={28} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                formatter={(v) => [`${v}%`, 'Nota']}
              />
              <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={60}>
                {stats.exam_scores.map((e, i) => (
                  <Cell key={i} fill={e.score >= 70 ? '#10b981' : e.score >= 50 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Weak topics */}
      {stats.weak_topics?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-slate-200 mb-4">{t("stats.weakTopics")}</h3>
          <div className="space-y-3">
            {stats.weak_topics.map((topic, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-200">{topic.topic}</span>
                  <span className="text-slate-400">{topic.success_rate}% {t("stats.successRate")}</span>
                </div>
                <ProgressBar value={topic.success_rate} max={100} color={topic.success_rate < 50 ? 'red' : 'yellow'} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subject distribution */}
      {stats.subject_distribution?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-slate-200 mb-4">{t("stats.subjectTime")}</h3>
          <div className="flex items-center gap-8">
            <PieChart width={160} height={160}>
              <Pie data={stats.subject_distribution} dataKey="minutes" innerRadius={40} outerRadius={70}>
                {stats.subject_distribution.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
            <div className="space-y-2">
              {stats.subject_distribution.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-slate-200">{s.name}</span>
                  <span className="text-slate-400 ml-auto">{Math.round(s.minutes / 60)}h</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
