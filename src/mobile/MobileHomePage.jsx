import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api, useAppStore } from '../store/appStore'
import MobileTabBar from './MobileTabBar'
import Logo from '../components/UI/Logo'
import PlanBadge from '../components/UI/PlanBadge'
import {
  IconAlertTriangle, IconBooks, IconCamera, IconMicrophone2, IconCalculator,
  IconHeadphones,
} from '@tabler/icons-react'

function daysUntil(examDate) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(examDate)
  d.setHours(0, 0, 0, 0)
  return Math.round((d - today) / 86400000)
}

export default function MobileHomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const setPlanTier = useAppStore(s => s.setPlanTier)
  const [urgentExams, setUrgentExams] = useState([])
  const [docCount, setDocCount]       = useState(null)

  useEffect(() => {
    // Tier real (incluye plan_override='pro' manual) para el badge — mobile
    // no tiene Sidebar.jsx, que es quien hace esto en escritorio/web.
    api('GET', '/usage/summary').then(data => setPlanTier(data.tier)).catch(() => {})
  }, [])

  useEffect(() => {
    // Exámenes urgentes (≤3 días)
    api('GET', '/exams/reminders').then(res => {
      const items = res.items || []
      setUrgentExams(items.filter(e => {
        const n = daysUntil(e.exam_date)
        return n >= 0 && n <= 3
      }))
    }).catch(() => {})

    // Número de documentos guardados
    api('GET', '/documents?limit=100').then(res => {
      setDocCount((res.items || []).length)
    }).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col px-5 pt-14 pb-24">
      {/* Cabecera */}
      <div className="mb-6">
        <h1 className="flex items-center gap-2"><Logo size="xl" /><PlanBadge /></h1>
        <p className="text-slate-400 mt-0.5 text-sm truncate">{user?.email}</p>
      </div>

      {/* Alertas de exámenes urgentes */}
      {urgentExams.length > 0 && (
        <div className="mb-5 space-y-2">
          {urgentExams.map(exam => {
            const n = daysUntil(exam.exam_date)
            const label = n === 0 ? '¡Hoy!' : n === 1 ? 'Mañana' : `En ${n} días`
            const style = n === 0 ? 'bg-red-900/40 border border-red-700/60'
                        : n === 1 ? 'bg-amber-900/30 border border-amber-700/40'
                        : 'bg-yellow-900/20 border border-yellow-800/30'
            const labelColor = n === 0 ? 'text-red-400' : n === 1 ? 'text-amber-400' : 'text-yellow-400'
            const dotColor = exam.color || exam.subject_color || '#8b5cf6'
            return (
              <button
                key={exam.id}
                onClick={() => navigate('/exams')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left ${style}`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                <IconAlertTriangle size={20} className={`shrink-0 ${n <= 1 ? 'text-red-400' : 'text-amber-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-100 truncate">{exam.title}</p>
                  <p className={`text-xs ${labelColor}`}>{label}</p>
                </div>
                <span className="text-slate-500 shrink-0">›</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Stat de documentos */}
      {docCount !== null && (
        <div className="mb-6 bg-slate-800/60 rounded-2xl px-4 py-3 flex items-center gap-3">
          <IconBooks size={26} className="text-primary-400" />
          <p className="text-slate-300 text-sm flex-1">
            <span className="font-bold text-slate-100 text-lg">{docCount}</span> documentos guardados
          </p>
          <button
            onClick={() => navigate('/library')}
            className="text-xs text-primary-400 active:text-primary-300 shrink-0"
          >
            Ver todos ›
          </button>
        </div>
      )}

      {/* Acciones principales */}
      <div className="flex-1 flex flex-col gap-4 justify-center">
        <button
          onClick={() => navigate('/scanner')}
          className="w-full py-7 rounded-2xl bg-primary-600 active:bg-primary-700
                     flex flex-col items-center gap-2 transition-colors shadow-lg"
        >
          <IconCamera size={44} className="text-white" />
          <span className="text-xl font-bold text-white">Escanear apuntes</span>
          <span className="text-primary-200 text-sm">Fotografía tus apuntes en papel</span>
        </button>

        <button
          onClick={() => navigate('/record')}
          className="w-full py-7 rounded-2xl bg-slate-700 active:bg-slate-600
                     flex flex-col items-center gap-2 transition-colors shadow-lg"
        >
          <IconMicrophone2 size={44} className="text-white" />
          <span className="text-xl font-bold text-white">Grabar apuntes</span>
          <span className="text-slate-400 text-sm">Dicta tus apuntes en voz</span>
        </button>

        <button
          onClick={() => navigate('/solve')}
          className="w-full py-7 rounded-2xl bg-slate-700 active:bg-slate-600
                     flex flex-col items-center gap-2 transition-colors shadow-lg"
        >
          <IconCalculator size={44} className="text-white" />
          <span className="text-xl font-bold text-white">Resolver ejercicio</span>
          <span className="text-slate-400 text-sm">Escanea un ejercicio y te lo resolvemos</span>
        </button>

        <button
          onClick={() => navigate('/podcasts')}
          className="w-full py-4 rounded-2xl bg-slate-800/60 active:bg-slate-700
                     flex items-center gap-3 px-5 transition-colors"
        >
          <IconHeadphones size={26} className="shrink-0 text-slate-300" />
          <div className="text-left flex-1 min-w-0">
            <p className="font-semibold text-white">Mis podcasts</p>
            <p className="text-slate-400 text-xs">Audios enviados desde el ordenador</p>
          </div>
          <span className="text-slate-500 shrink-0">›</span>
        </button>
      </div>

      <MobileTabBar />
    </div>
  )
}
